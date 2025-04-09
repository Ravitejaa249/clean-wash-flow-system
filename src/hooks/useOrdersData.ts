import { useState, useEffect, useCallback } from 'react';
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

  const processOrderData = useCallback(async (orderData: any[]) => {
    if (!orderData?.length) return [];

    const ordersWithItems = await Promise.all(
      orderData.map(async (order) => {
        try {
          // Fetch student profile with an improved query
          console.log('Fetching profile for student_id:', order.student_id);
          
          // Use a more explicit query to fetch the student profile
          const { data: studentData, error: studentError } = await supabase
            .from('profiles')
            .select('id, full_name, gender, hostel, floor, washes_left, total_washes')
            .eq('id', order.student_id)
            .single();

          if (studentError) {
            console.error('Error fetching student profile:', studentError);
          }

          console.log('Student data fetched:', studentData);

          // Create a properly structured student profile
          const studentProfile = studentData ? {
            full_name: studentData.full_name || 'Unknown Student',
            gender: studentData.gender || 'unknown',
            hostel: studentData.hostel || 'N/A',
            floor: studentData.floor || 'N/A',
            washes_left: studentData.washes_left || 0,
            total_washes: studentData.total_washes || 40
          } : createFallbackStudent();

          // Fetch order items
          const { data: items, error: itemsError } = await supabase
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

          if (itemsError) {
            console.error('Failed to fetch order items:', itemsError);
            return { ...order, items: [], student: studentProfile };
          }

          return {
            ...order,
            items: items || [],
            student: studentProfile
          } as Order;
        } catch (err) {
          console.error('Error processing order data:', err);
          return { ...order, items: [], student: createFallbackStudent() } as Order;
        }
      })
    );

    return ordersWithItems;
  }, []);

  const fetchAllOrders = useCallback(async () => {
    try {
      setLoading({ orders: true, activeOrders: true });

      // Fetch pending orders (new orders)
      const { data: pendingData, error: pendingError } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (pendingError) {
        console.error('Error fetching pending orders:', pendingError);
        toast({
          title: 'Error',
          description: 'Failed to load pending orders.',
          variant: 'destructive',
        });
      } else {
        console.log('Pending orders fetched:', pendingData?.length || 0);
        const processed = await processOrderData(pendingData || []);
        setOrders(processed);
      }
      setLoading(prev => ({ ...prev, orders: false }));

      // Fetch active orders (accepted or processing)
      const { data: activeData, error: activeError } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['accepted', 'processing'])
        .order('created_at', { ascending: false });

      if (activeError) {
        console.error('Error fetching active orders:', activeError);
        toast({
          title: 'Error',
          description: 'Failed to load active orders.',
          variant: 'destructive',
        });
      } else {
        console.log('Active orders fetched:', activeData?.length || 0);
        const processed = await processOrderData(activeData || []);
        setActiveOrders(processed);
      }
      setLoading(prev => ({ ...prev, activeOrders: false }));
      
    } catch (err) {
      console.error('Unexpected fetch error:', err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while loading orders.',
        variant: 'destructive',
      });
      setLoading({ orders: false, activeOrders: false });
    }
  }, [processOrderData]);

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
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to orders changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Failed to subscribe to orders changes');
          toast({
            title: 'Connection Error',
            description: 'Failed to establish real-time connection for order updates.',
            variant: 'destructive',
          });
        }
      });

    return () => {
      // Clean up subscription on unmount
      supabase.removeChannel(ordersChannel);
    };
  }, [fetchAllOrders]);

  return {
    orders,
    activeOrders,
    loading,
    refreshOrders: fetchAllOrders,
  };
}
