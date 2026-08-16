import { supabase } from '../../infrastructure/api/supabase';

/**
 * CRM Service for handling client portal operations
 */
export class CRMService {
  /**
   * Create a new client user account for existing customer
   */
  static async createClientUser(customerData: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    company_name?: string;
    tax_id?: string;
    website?: string;
  }) {
    try {
      // Generate a cryptographically secure random password
      const tempPassword = CRMService.generateSecurePassword();
      
      // First create the auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: customerData.email,
        password: tempPassword,
        options: {
          data: { name: customerData.name, password: tempPassword }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create auth user');

      // Get client portal role
      const { data: roleData } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'client_portal')
        .single();

      if (!roleData) throw new Error('Client portal role not found');

      // Insert into public.users table if it doesn't exist
      try {
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: customerData.email,
            name: customerData.name,
            role_id: roleData.id
          });
        
        if (insertError && insertError.code !== '23505') { // Ignore duplicate key error
          console.warn('Could not insert user, trying update instead:', insertError);
          // Try update if insert failed
          await supabase
            .from('users')
            .update({ role_id: roleData.id, name: customerData.name })
            .eq('id', authData.user.id);
        }
      } catch (userError) {
        console.warn('Could not create/update public.users record:', userError);
      }

      return {
        success: true,
        user_id: authData.user.id,
        tempPassword
      };
    } catch (error) {
      console.error('Error creating client user:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate a cryptographically secure random password
   */
  private static generateSecurePassword(): string {
    const array = new Uint8Array(12); // 12 bytes = 16 chars in base64
    crypto.getRandomValues(array);
    
    // Convert to base64 and use only alphanumeric characters
    const base64 = btoa(String.fromCharCode(...array));
    const alphanumeric = base64.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
    
    // Ensure at least one uppercase, one lowercase, and one digit
    const hasUpper = /[A-Z]/.test(alphanumeric);
    const hasLower = /[a-z]/.test(alphanumeric);
    const hasDigit = /[0-9]/.test(alphanumeric);
    
    let password = alphanumeric;
    if (!hasUpper) password = 'A' + password.slice(0, 11);
    if (!hasLower) password = password.slice(0, 11) + 'a';
    if (!hasDigit) password = password.slice(0, 11) + '1';
    
    return password;
  }

  /**
   * Link CRM user to existing customer
   */
  static async linkCrmUserToCustomer(customerId: string, userId: string) {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ 
          user_id: userId,
          is_active: true,
          credit_status: 'good'
        })
        .eq('id', customerId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error linking CRM user to customer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create a new order request from client portal
   */
  static async createOrderRequest(orderData: {
    customer_id: string;
    items: Array<{
      item_id: string;
      qty: number;
      unit_price: number;
      item_name?: string;
      item_sku?: string;
    }>;
    delivery_address?: string;
    requested_delivery_date?: string;
    notes?: string;
    payment_method?: string;
  }) {
    try {
      // Calculate total amount
      const total_amount = orderData.items.reduce(
        (sum, item) => sum + (item.qty * item.unit_price),
        0
      );

      // Create order
      const { data: createdOrder, error: orderError } = await supabase
        .from('crm_orders')
        .insert({
          customer_id: orderData.customer_id,
          order_date: new Date().toISOString().split('T')[0],
          requested_delivery_date: orderData.requested_delivery_date,
          total_amount,
          delivery_address: orderData.delivery_address,
          notes: orderData.notes,
          payment_method: orderData.payment_method || 'credit',
          status: 'pending',
          payment_status: 'pending'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order lines
      const orderLines = orderData.items.map(item => ({
        order_id: createdOrder.id,
        item_id: item.item_id,
        qty: item.qty,
        unit_price: item.unit_price,
        line_total: item.qty * item.unit_price,
        item_name: item.item_name,
        item_sku: item.item_sku
      }));

      const { error: linesError } = await supabase
        .from('crm_order_lines')
        .insert(orderLines);

      if (linesError) throw linesError;

      // Create notification for admin
      await supabase
        .from('client_notifications')
        .insert({
          customer_id: orderData.customer_id,
          type: 'order_status',
          title: 'طلب جديد',
          message: `تم استلام طلب جديد من العميل`,
          data: {
            order_id: createdOrder.id,
            order_number: createdOrder.order_number,
            total_amount
          }
        });

      return {
        success: true,
        order: createdOrder
      };
    } catch (error) {
      console.error('Error creating order request:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get available items for client ordering
   */
  static async getAvailableItems() {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('id, name, sku, unit_price, description')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      return { success: true, items: data || [] };
    } catch (error) {
      console.error('Error fetching items:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get client notifications
   */
  static async getClientNotifications(customerId: string) {
    try {
      const { data, error } = await supabase
        .from('client_notifications')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      return { success: true, notifications: data || [] };
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Mark notification as read
   */
  static async markNotificationAsRead(notificationId: string) {
    try {
      const { error } = await supabase
        .from('client_notifications')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('id', notificationId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Track delivery status
   */
  static async trackDelivery(trackingNumber: string) {
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          *,
          crm_orders (
            order_number,
            customer_id,
            customers (
              name,
              address
            )
          )
        `)
        .eq('tracking_number', trackingNumber)
        .single();

      if (error) throw error;

      return { success: true, delivery: data };
    } catch (error) {
      console.error('Error tracking delivery:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}