import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
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
        toast({
          title: 'Error',
          description: 'Failed to load pending orders.',
          variant: 'destructive',
        });
        setLoading(prev => ({ ...prev, orders: false }));
      } else {
        const processed = await processOrderData(pendingData);
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
        toast({
          title: 'Error',
          description: 'Failed to load active orders.',
          variant: 'destructive',
        });
        setLoading(prev => ({ ...prev, activeOrders: false }));
      } else {
        const processed = await processOrderData(activeData);
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
    fetchAllOrders();

    const ordersChannel = supabase
      .channel('orders-channel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
      }, () => {
        fetchAllOrders();
      })
      .subscribe();

    return () => {
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
