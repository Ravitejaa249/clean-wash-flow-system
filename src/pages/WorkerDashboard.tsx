
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { 
  Clock,
  Package,
  CheckCircle,
  XCircle,
  AlertCircle,
  Truck,
  User,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Building
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import Logo from '@/components/Logo';
import { Database } from '@/integrations/supabase/types';

interface OrderStudent {
  full_name: string;
  gender: string;
  hostel: string;
  floor: string;
}

type OrderStatus = Database['public']['Enums']['order_status'];

interface Order {
  id: string;
  student_id: string;
  status: OrderStatus;
  total_price: number;
  pickup_date: string;
  delivery_date: string | null;
  created_at: string;
  notes: string | null;
  worker_id: string | null;
  student: OrderStudent | null;
  items: any[] | null;
}

// Type guard to check if the student data is valid
function isValidStudentData(student: any): student is OrderStudent {
  return student && 
    typeof student === 'object' && 
    'full_name' in student && 
    'gender' in student && 
    'hostel' in student && 
    'floor' in student;
}

// Helper function to create a fallback student object when there's an error
function createFallbackStudent(): OrderStudent {
  return {
    full_name: 'Unknown Student',
    gender: 'unknown',
    hostel: 'N/A',
    floor: 'N/A'
  };
}

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const WorkerDashboard = () => {
  const { signOut, profile, user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');
  const [loading, setLoading] = useState({
    orders: true,
    activeOrders: true,
    updateStatus: false
  });

  // Fetch all orders (both pending and active)
  const fetchAllOrders = async () => {
    if (!user?.id) return;

    try {
      // Fetch pending orders
      const { data: pendingData, error: pendingError } = await supabase
        .from('orders')
        .select(`
          *,
          student:student_id (
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
          description: 'Could not load pending orders',
          variant: 'destructive',
        });
        return;
      }

      // Fetch active orders (accepted, processing)
      const { data: activeData, error: activeError } = await supabase
        .from('orders')
        .select(`
          *,
          student:student_id (
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
          description: 'Could not load active orders',
          variant: 'destructive',
        });
        return;
      }

      // Process pending orders
      const pendingOrdersWithItems = await processOrderData(pendingData || []);
      setOrders(pendingOrdersWithItems);
      setLoading(prev => ({ ...prev, orders: false }));

      // Process active orders
      const activeOrdersWithItems = await processOrderData(activeData || []);
      setActiveOrders(activeOrdersWithItems);
      setLoading(prev => ({ ...prev, activeOrders: false }));

    } catch (err) {
      console.error('Unexpected error in fetchAllOrders:', err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while loading orders',
        variant: 'destructive',
      });
    }
  };

  // Helper function to process order data and fetch items
  const processOrderData = async (orderData: any[]) => {
    const ordersWithItems = await Promise.all(
      orderData.map(async (order) => {
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
          return { ...order, items: null };
        }

        // Handle student data properly - if we have error or invalid data, use fallback
        let studentData = null;
        if (isValidStudentData(order.student)) {
          studentData = order.student;
        } else if (order.student && 'error' in order.student) {
          console.error('Error with student data:', order.student);
          studentData = createFallbackStudent();
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
  };

  // Set up initial data loading and real-time subscriptions
  useEffect(() => {
    if (!user?.id) return;

    // Fetch all orders initially
    fetchAllOrders();

    // Set up real-time subscription for all orders
    const ordersChannel = supabase
      .channel('all-orders')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders'
        }, 
        (payload) => {
          console.log('Order updated:', payload);
          fetchAllOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, [user]);

  // Update order status
  const updateOrderStatus = async (orderId: string) => {
    if (!selectedStatus) {
      toast({
        title: 'Status required',
        description: 'Please select a status for the order',
        variant: 'destructive',
      });
      return;
    }

    setLoading(prev => ({ ...prev, updateStatus: true }));
    
    try {
      const updateData: any = { 
        status: selectedStatus
      };
      
      // Add worker_id if accepting the order
      if (selectedStatus === 'accepted' && user?.id) {
        updateData.worker_id = user.id;
      }
      
      // Add delivery date when order is completed
      if (selectedStatus === 'completed') {
        updateData.delivery_date = new Date().toISOString();
      }

      // Add delivery notes if provided
      if (deliveryNotes.trim() && selectedStatus === 'completed') {
        updateData.notes = deliveryNotes.trim();
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) {
        throw error;
      }

      toast({
        title: 'Status updated',
        description: `Order status has been updated to ${selectedStatus}`,
      });

      // Reset form
      setSelectedStatus('');
      setDeliveryNotes('');
      setExpandedOrder(null);
      
      // Orders will update via real-time subscription
    } catch (error: any) {
      console.error('Error updating order status:', error);
      toast({
        title: 'Error updating status',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, updateStatus: false }));
    }
  };

  const handleOrderClick = (orderId: string) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
    setSelectedStatus('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'accepted':
        return 'bg-blue-100 text-blue-800';
      case 'processing':
        return 'bg-purple-100 text-purple-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'accepted':
        return <CheckCircle className="h-4 w-4" />;
      case 'processing':
        return <Package className="h-4 w-4" />;
      case 'completed':
        return <Truck className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy h:mm a');
  };

  // Helper function to display student information safely
  const getStudentName = (student: OrderStudent | null) => {
    return student?.full_name || 'Unknown Student';
  };

  // Helper function to display hostel information safely
  const getStudentLocation = (student: OrderStudent | null) => {
    if (student?.hostel && student?.floor) {
      return `Block ${student.hostel}, Floor ${student.floor}`;
    }
    return 'N/A';
  };

  // Helper function to render an order card
  const renderOrderCard = (order: Order) => {
    return (
      <Card key={order.id} className="overflow-hidden">
        <div 
          className="p-4 cursor-pointer"
          onClick={() => handleOrderClick(order.id)}
        >
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="font-medium">Order #{order.id.slice(0, 8)}</h3>
                <Badge className={getStatusColor(order.status)}>
                  <span className="flex items-center space-x-1">
                    {getStatusIcon(order.status)}
                    <span>{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</span>
                  </span>
                </Badge>
              </div>
              <div className="space-y-1 mt-2">
                <p className="text-sm flex items-center text-gray-600">
                  <User className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                  {getStudentName(order.student)}
                </p>
                <p className="text-sm flex items-center text-gray-600">
                  <Building className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                  {getStudentLocation(order.student)}
                </p>
                <p className="text-sm flex items-center text-gray-600">
                  <CalendarClock className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                  Pickup: {formatDate(order.pickup_date)}
                </p>
              </div>
              <p className="text-sm font-semibold mt-2">₹{order.total_price.toFixed(2)}</p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="shrink-0"
              aria-label={expandedOrder === order.id ? "Collapse" : "Expand"}
            >
              {expandedOrder === order.id ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {expandedOrder === order.id && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              {order.items && (
                <div className="mb-4">
                  <h4 className="font-medium mb-2">Order Items</h4>
                  <div className="space-y-2">
                    {order.items.map((item: any) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <div className="flex">
                          <span className="text-gray-600">{item.quantity}x</span>
                          <span className="ml-2">{item.clothing_items.name}</span>
                        </div>
                        <span>₹{item.price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {order.notes && (
                <div className="mb-4">
                  <h4 className="font-medium mb-1">Customer Notes</h4>
                  <p className="text-sm text-gray-600">{order.notes}</p>
                </div>
              )}
              
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Update Status</h4>
                  <Select 
                    value={selectedStatus} 
                    onValueChange={setSelectedStatus}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select new status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(option => (
                        <SelectItem 
                          key={option.value} 
                          value={option.value}
                          disabled={option.value === order.status}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedStatus === 'completed' && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Delivery Notes (Optional)</h4>
                    <Textarea
                      placeholder="Any notes about the delivery?"
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>
                )}
                
                <Button 
                  onClick={() => updateOrderStatus(order.id)}
                  disabled={loading.updateStatus || !selectedStatus}
                  className="w-full"
                >
                  {loading.updateStatus ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Updating...
                    </>
                  ) : (
                    "Update Status"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="w-full py-4 px-4 bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Logo />
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700 mr-2">
              {profile?.full_name}
            </span>
            <Button
              variant="outline"
              onClick={() => signOut()}
              size="sm"
              className="text-sm"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Worker Dashboard</h1>
          <p className="text-gray-600 mb-6">
            Welcome to your dashboard. Here you can manage laundry orders and update their status.
          </p>
          
          <Tabs defaultValue="active-orders" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="active-orders">Active Orders</TabsTrigger>
              <TabsTrigger value="new-orders">New Orders</TabsTrigger>
            </TabsList>
            
            <TabsContent value="active-orders" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Package className="mr-2 h-5 w-5" />
                    Active Orders
                  </CardTitle>
                  <CardDescription>
                    Manage orders that are currently being processed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading.activeOrders ? (
                    <div className="flex justify-center p-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : activeOrders.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No active orders at the moment</p>
                      <p className="text-sm text-gray-400 mt-1">Accept new orders from the New Orders tab</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activeOrders.map(order => renderOrderCard(order))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="new-orders" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Clock className="mr-2 h-5 w-5" />
                    New Orders
                  </CardTitle>
                  <CardDescription>
                    Accept new orders to process
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading.orders ? (
                    <div className="flex justify-center p-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No new orders available at the moment</p>
                      <p className="text-sm text-gray-400 mt-1">New orders will appear here when students place them</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map(order => renderOrderCard(order))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <footer className="py-6 px-4 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} CleanWash. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default WorkerDashboard;
