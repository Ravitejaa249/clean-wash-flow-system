
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

  // Helper function to process order data and fetch items
  const processOrderData = async (orderData: any[]) => {
    try {
      if (!orderData || orderData.length === 0) return [];
      
      const ordersWithItems = await Promise.all(
        orderData.map(async (order) => {
          console.log('Processing order:', order.id);
          
          // Handle student data properly
          let studentData = null;
          if (order.student) {
            if (isValidStudentData(order.student)) {
              studentData = order.student;
            } else {
              console.warn('Invalid student data for order:', order.id);
              studentData = createFallbackStudent();
            }
          } else {
            console.warn('No student data for order:', order.id);
            studentData = createFallbackStudent();
          }

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
            console.error('Error fetching order items:', itemsError);
            return { ...order, items: null, student: studentData };
          }

          // Create a properly typed order with validated student data
          const validatedOrder: Order = {
            id: order.id,
            student_id: order.student_id,
            status: order.status,
            total_price: order.total_price,
            pickup_date: order.pickup_date,
            delivery_date: order.delivery_date,
            created_at: order.created_at,
            notes: order.notes,
            worker_id: order.worker_id,
            items: items || null,
            student: studentData
          };

          return validatedOrder;
        })
      );

      return ordersWithItems as Order[];
    } catch (error) {
      console.error('Error in processOrderData:', error);
      return [];
    }
  };

  // Fetch all orders (both pending and active)
  const fetchAllOrders = async () => {
    try {
      console.log('Fetching all orders...');
      setLoading(prev => ({ ...prev, orders: true, activeOrders: true }));
      
      // Fetch pending orders
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
          description: 'Could not load pending orders. Please try again later.',
          variant: 'destructive',
        });
        setLoading(prev => ({ ...prev, orders: false }));
      } else {
        console.log('Pending orders fetched:', pendingData);
        
        // Process pending orders
        const pendingOrdersWithItems = await processOrderData(pendingData || []);
        setOrders(pendingOrdersWithItems);
        setLoading(prev => ({ ...prev, orders: false }));
      }

      // Fetch active orders (accepted, processing)
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
          description: 'Could not load active orders. Please try again later.',
          variant: 'destructive',
        });
        setLoading(prev => ({ ...prev, activeOrders: false }));
      } else {
        console.log('Active orders fetched:', activeData);
        
        // Process active orders
        const activeOrdersWithItems = await processOrderData(activeData || []);
        setActiveOrders(activeOrdersWithItems);
        setLoading(prev => ({ ...prev, activeOrders: false }));
      }

    } catch (err) {
      console.error('Unexpected error in fetchAllOrders:', err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while loading orders',
        variant: 'destructive',
      });
      setLoading(prev => ({ ...prev, orders: false, activeOrders: false }));
    }
  };

  // Set up initial data loading
  useEffect(() => {
    console.log('Setting up data loading');
    
    // Fetch all orders initially
    fetchAllOrders();

    // Set up real-time subscription for all orders
    const ordersChannel = supabase
      .channel('orders-channel')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders'
        }, 
        (payload) => {
          console.log('Order update received:', payload);
          fetchAllOrders();
        }
      )
      .subscribe(status => {
        console.log('Subscription status:', status);
      });

    return () => {
      console.log('Cleaning up subscriptions');
      supabase.removeChannel(ordersChannel);
    };
  }, []);

  return {
    orders,
    activeOrders,
    loading,
    refreshOrders: fetchAllOrders
  };
}
