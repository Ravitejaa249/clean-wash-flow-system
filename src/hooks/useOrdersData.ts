
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Order, isValidStudentData, createFallbackStudent } from '@/types/order.types';

export function useOrdersData() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState({
    orders: true,
    activeOrders: true,
  });

  const processOrderData = async (orderData: any[]) => {
    if (!orderData?.length) return [];

    const ordersWithItems = await Promise.all(
      orderData.map(async (order) => {
        let studentData = isValidStudentData(order.student)
          ? order.student
          : createFallbackStudent();

        const { data: items, error } = await supabase
          .from('order_items')
          .select(`
            id,
            quantity,
            price,
            clothing_items (
              id,
              name,
              price,
              description
            )
          `)
          .eq('order_id', order.id);

        if (error) {
          console.error('Failed to fetch order items:', error);
          return { ...order, items: null, student: studentData };
        }

        return {
          ...order,
          items,
          student: studentData
        } as Order;
      })
    );

    return ordersWithItems;
  };

  const fetchAllOrders = async () => {
    try {
      setLoading({ orders: true, activeOrders: true });

      const { data: pendingData, error: pendingError } = await supabase
        .from('orders')
        .select(`
          *,
          student:profiles(
            full_name,
            gender,
            hostel,
            floor
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (pendingError) {
        console.error('Error fetching pending orders:', pendingError);
        toast({
          title: 'Error',
          description: 'Failed to load pending orders.',
          variant: 'destructive',
        });
        setLoading(prev => ({ ...prev, orders: false }));
      } else {
        console.log('Pending orders fetched:', pendingData?.length || 0);
        const processed = await processOrderData(pendingData || []);
        setOrders(processed);
        setLoading(prev => ({ ...prev, orders: false }));
      }

      const { data: activeData, error: activeError } = await supabase
        .from('orders')
        .select(`
          *,
          student:profiles(
            full_name,
            gender,
            hostel,
            floor
          )
        `)
        .in('status', ['accepted', 'processing'])
        .order('created_at', { ascending: false });

      if (activeError) {
        console.error('Error fetching active orders:', activeError);
        toast({
          title: 'Error',
          description: 'Failed to load active orders.',
          variant: 'destructive',
        });
        setLoading(prev => ({ ...prev, activeOrders: false }));
      } else {
        console.log('Active orders fetched:', activeData?.length || 0);
        const processed = await processOrderData(activeData || []);
        setActiveOrders(processed);
        setLoading(prev => ({ ...prev, activeOrders: false }));
      }
    } catch (err) {
      console.error('Unexpected fetch error:', err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while loading orders.',
        variant: 'destructive',
      });
      setLoading({ orders: false, activeOrders: false });
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchAllOrders();

    // Set up real-time subscription for ALL order changes
    const ordersChannel = supabase
      .channel('orders-changes')
      .on('postgres_changes', {
        event: '*',  // Listen for all events (insert, update, delete)
        schema: 'public',
        table: 'orders',
      }, (payload) => {
        console.log('Real-time order change detected:', payload);
        // Immediately refetch all orders when any order changes
        fetchAllOrders();
      })
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      // Clean up subscription on unmount
      supabase.removeChannel(ordersChannel);
    };
  }, []);

  return {
    orders,
    activeOrders,
    loading,
    refreshOrders: fetchAllOrders,
  };
}
