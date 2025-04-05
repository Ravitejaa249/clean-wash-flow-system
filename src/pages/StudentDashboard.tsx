
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import Logo from '@/components/Logo';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { 
  Package, 
  Clock, 
  ShoppingCart, 
  Wallet, 
  Calendar, 
  Check, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Database } from '@/integrations/supabase/types';

type OrderStatus = Database['public']['Enums']['order_status'];

interface ClothingItem {
  id: string;
  name: string;
  gender: string;
  price: number;
  description: string | null;
  quantity?: number;
}

interface Order {
  id: string;
  created_at: string;
  status: OrderStatus;
  total_price: number;
  pickup_date: string;
  delivery_date: string | null;
  notes: string | null;
  items: any[] | null;
}

const StudentDashboard = () => {
  const { signOut, profile, user } = useAuth();
  const [clothingItems, setClothingItems] = useState<ClothingItem[]>([]);
  const [cart, setCart] = useState<ClothingItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notes, setNotes] = useState('');
  const [pickupDate, setPickupDate] = useState(format(new Date(), 'yyyy-MM-dd\'T\'HH:mm'));
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [loading, setLoading] = useState({
    clothingItems: true,
    orders: true,
    placeOrder: false
  });

  // Fetch clothing items based on user's gender
  useEffect(() => {
    const fetchClothingItems = async () => {
      if (profile?.gender) {
        const { data, error } = await supabase
          .from('clothing_items')
          .select('*')
          .eq('gender', profile.gender);

        if (error) {
          console.error('Error fetching clothing items:', error);
          toast({
            title: 'Error',
            description: 'Could not load clothing items',
            variant: 'destructive',
          });
          return;
        }

        setClothingItems(data || []);
        setLoading(prev => ({ ...prev, clothingItems: false }));
      }
    };

    fetchClothingItems();
  }, [profile]);

  // Fetch user's orders
  useEffect(() => {
    if (!user?.id) return;
    
    const fetchOrders = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching orders:', error);
        toast({
          title: 'Error',
          description: 'Could not load orders',
          variant: 'destructive',
        });
        return;
      }

      // Fetch order items for each order
      const ordersWithItems = await Promise.all(
        (data || []).map(async (order) => {
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

          return { ...order, items };
        })
      );

      setOrders(ordersWithItems);
      setLoading(prev => ({ ...prev, orders: false }));
    };

    fetchOrders();

    // Subscribe to real-time updates
    const ordersSubscription = supabase
      .channel('public:orders')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `student_id=eq.${user.id}` 
        }, 
        () => {
          // Refresh orders when there's a change
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersSubscription);
    };
  }, [user]);

  const addToCart = (item: ClothingItem) => {
    const existingItem = cart.find(cartItem => cartItem.id === item.id);
    
    if (existingItem) {
      setCart(cart.map(cartItem => 
        cartItem.id === item.id 
          ? { ...cartItem, quantity: (cartItem.quantity || 1) + 1 } 
          : cartItem
      ));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
    
    toast({
      title: 'Added to cart',
      description: `${item.name} added to your laundry basket`,
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity < 1) return;
    
    setCart(cart.map(item => 
      item.id === itemId ? { ...item, quantity } : item
    ));
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => {
      return total + (item.price * (item.quantity || 1));
    }, 0);
  };

  const handlePlaceOrder = async () => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please log in before placing an order',
        variant: 'destructive',
      });
      return;
    }

    if (cart.length === 0) {
      toast({
        title: 'Empty cart',
        description: 'Please add items to your laundry basket before placing an order',
        variant: 'destructive',
      });
      return;
    }

    setLoading(prev => ({ ...prev, placeOrder: true }));

    try {
      // Create the order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          student_id: user.id,
          status: 'pending',
          total_price: calculateTotal(),
          pickup_date: new Date(pickupDate).toISOString(),
          notes: notes.trim() || null,
        })
        .select()
        .single();

      if (orderError) {
        throw orderError;
      }

      if (!orderData) {
        throw new Error('Failed to create order');
      }

      // Create order items
      const orderItems = cart.map(item => ({
        order_id: orderData.id,
        clothing_item_id: item.id,
        quantity: item.quantity || 1,
        price: item.price * (item.quantity || 1),
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        throw itemsError;
      }

      toast({
        title: 'Order placed successfully',
        description: `Your order #${orderData.id.slice(0, 8)} has been placed`,
      });

      // Reset form
      setCart([]);
      setNotes('');
      setPickupDate(format(new Date(), 'yyyy-MM-dd\'T\'HH:mm'));
    } catch (error: any) {
      console.error('Error placing order:', error);
      toast({
        title: 'Error placing order',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, placeOrder: false }));
    }
  };

  const handleOrderClick = (orderId: string) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  const cancelOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
        .eq('student_id', user?.id);

      if (error) {
        throw error;
      }

      toast({
        title: 'Order cancelled',
        description: 'Your order has been cancelled successfully',
      });

      // Order list will update automatically via the real-time subscription
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel order',
        variant: 'destructive',
      });
    }
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

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy h:mm a');
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Student Dashboard</h1>
          <p className="text-gray-600 mb-6">
            Welcome to your laundry dashboard. Here you can place new orders and track existing ones.
          </p>
          
          <Tabs defaultValue="place-order" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="place-order">Place Order</TabsTrigger>
              <TabsTrigger value="my-orders">My Orders</TabsTrigger>
            </TabsList>
            
            <TabsContent value="place-order" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Package className="mr-2 h-5 w-5" />
                        Clothing Items
                      </CardTitle>
                      <CardDescription>
                        Select the items you want to send for laundry
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loading.clothingItems ? (
                        <div className="flex justify-center p-4">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                      ) : clothingItems.length === 0 ? (
                        <p className="text-center text-gray-500 py-4">
                          No clothing items available
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4">
                          {clothingItems.map((item) => (
                            <Card key={item.id} className="overflow-hidden">
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h3 className="font-medium">{item.name}</h3>
                                    <p className="text-sm text-gray-500">{item.description}</p>
                                    <p className="text-sm font-semibold mt-1">₹{item.price.toFixed(2)}</p>
                                  </div>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => addToCart(item)}
                                  >
                                    Add
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Calendar className="mr-2 h-5 w-5" />
                        Order Details
                      </CardTitle>
                      <CardDescription>
                        Specify when you want your clothes picked up
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="pickup-date">Pickup Date & Time</Label>
                        <Input
                          id="pickup-date"
                          type="datetime-local"
                          value={pickupDate}
                          onChange={(e) => setPickupDate(e.target.value)}
                          min={format(new Date(), 'yyyy-MM-dd\'T\'HH:mm')}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="notes">Notes (Optional)</Label>
                        <Textarea
                          id="notes"
                          placeholder="Any special instructions for handling your clothes?"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="min-h-[100px]"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                <div>
                  <Card className="sticky top-24">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <ShoppingCart className="mr-2 h-5 w-5" />
                        Your Laundry Basket
                      </CardTitle>
                      <CardDescription>
                        Items you've selected for laundry
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {cart.length === 0 ? (
                        <div className="text-center py-6">
                          <p className="text-gray-500">Your basket is empty</p>
                          <p className="text-sm text-gray-400 mt-1">Add items to continue</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="space-y-3">
                            {cart.map((item) => (
                              <div key={item.id} className="flex justify-between items-center py-2 border-b">
                                <div>
                                  <p className="font-medium">{item.name}</p>
                                  <p className="text-sm text-gray-500">₹{item.price} per item</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <div className="flex items-center space-x-1">
                                    <Button 
                                      variant="outline" 
                                      size="icon" 
                                      className="h-6 w-6"
                                      onClick={() => updateQuantity(item.id, (item.quantity || 1) - 1)}
                                    >
                                      <span className="sr-only">Decrease quantity</span>
                                      <ChevronDown className="h-3 w-3" />
                                    </Button>
                                    <span className="w-8 text-center">{item.quantity || 1}</span>
                                    <Button 
                                      variant="outline" 
                                      size="icon" 
                                      className="h-6 w-6"
                                      onClick={() => updateQuantity(item.id, (item.quantity || 1) + 1)}
                                    >
                                      <span className="sr-only">Increase quantity</span>
                                      <ChevronUp className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 text-red-500"
                                    onClick={() => removeFromCart(item.id)}
                                  >
                                    <span className="sr-only">Remove</span>
                                    <svg 
                                      xmlns="http://www.w3.org/2000/svg" 
                                      fill="none" 
                                      viewBox="0 0 24 24" 
                                      strokeWidth={1.5} 
                                      stroke="currentColor" 
                                      className="w-4 h-4"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          <div className="pt-2 border-t border-dashed">
                            <div className="flex justify-between items-center py-2">
                              <p className="font-medium">Total Amount:</p>
                              <p className="font-bold">₹{calculateTotal().toFixed(2)}</p>
                            </div>
                          </div>
                          
                          <Button 
                            className="w-full" 
                            onClick={handlePlaceOrder} 
                            disabled={loading.placeOrder || cart.length === 0}
                          >
                            {loading.placeOrder ? (
                              <>
                                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                Processing...
                              </>
                            ) : (
                              <>
                                <Wallet className="mr-2 h-4 w-4" />
                                Place Order
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="my-orders" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Clock className="mr-2 h-5 w-5" />
                    My Orders
                  </CardTitle>
                  <CardDescription>
                    Track and manage your laundry orders
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading.orders ? (
                    <div className="flex justify-center p-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">You haven't placed any orders yet</p>
                      <p className="text-sm text-gray-400 mt-1">Orders will appear here once you place them</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((order) => (
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
                                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-500">
                                  Placed on {formatDate(order.created_at)}
                                </p>
                                <p className="text-sm text-gray-500">
                                  Pickup: {formatDate(order.pickup_date)}
                                </p>
                                {order.delivery_date && (
                                  <p className="text-sm text-gray-500">
                                    Delivery: {formatDate(order.delivery_date)}
                                  </p>
                                )}
                                <p className="text-sm font-semibold mt-1">₹{order.total_price.toFixed(2)}</p>
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
                            
                            {expandedOrder === order.id && order.items && (
                              <div className="mt-4 pt-4 border-t border-gray-100">
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
                                
                                {order.notes && (
                                  <div className="mt-4">
                                    <h4 className="font-medium mb-1">Notes</h4>
                                    <p className="text-sm text-gray-600">{order.notes}</p>
                                  </div>
                                )}
                                
                                {order.status === 'pending' && (
                                  <div className="mt-4 flex justify-end">
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Cancel order logic here
                                      }}
                                    >
                                      Cancel Order
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </Card>
                      ))}
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

export default StudentDashboard;
