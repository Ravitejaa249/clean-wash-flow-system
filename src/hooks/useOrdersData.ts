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

  // Single query to fetch orders with all related data
  const fetchOrders = async (statusFilters: string[]) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          student:profiles(full_name, gender, hostel, floor),
          order_items(
            id, 
            quantity, 
            price,
            clothing_items(id, name, price, description)
          )
        `)
        .in('status', statusFilters)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: 'Error',
        description: 'Could not load orders. Please try again later.',
        variant: 'destructive',
      });
      return null;
    }
  };

  // Process and validate order data structure
  const processOrders = (rawOrders: any[]): Order[] => {
    return rawOrders.map((order) => {
      // Validate student data
      let studentData = createFallbackStudent();
      if (order.student && isValidStudentData(order.student)) {
        studentData = order.student;
      }

      // Map order items
      const items = order.order_items?.map((item: any) => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price,
        clothing_item: item.clothing_items,
      })) || null;

      return {
        id: order.id,
        student_id: order.student_id,
        status: order.status,
        total_price: order.total_price,
        pickup_date: order.pickup_date,
        delivery_date: order.delivery_date,
        created_at: order.created_at,
        notes: order.notes,
        worker_id: order.worker_id,
        items,
        student: studentData,
      };
    });
  };

  // Fetch and update orders
  const updateOrders = async () => {
    try {
      setLoading({ orders: true, activeOrders: true });

      // Fetch both order types in parallel
      const [pendingData, activeData] = await Promise.all([
        fetchOrders(['pending']),
        fetchOrders(['accepted', 'processing']),
      ]);

      if (pendingData) setOrders(processOrders(pendingData));
      if (activeData) setActiveOrders(processOrders(activeData));
      
    } catch (error) {
      console.error('Error updating orders:', error);
    } finally {
      setLoading({ orders: false, activeOrders: false });
    }
  };

  // Initial data load
  useEffect(() => {
    updateOrders();

    // Realtime subscription
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => updateOrders()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return {
    orders,
    activeOrders,
    loading,
    refreshOrders: updateOrders
  };
}
