export interface User {
    id: number;
    email: string;
    name: string;
    password?: string;
    role: 'Admin' | 'Cashier' | 'Waiter' | 'KitchenStaff';
    salary?: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface Otp {
    id: number;
    email: string;
    otp: string;
    status: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface FoodCategory {
    id: number;
    name: string;
    image?: string;
    status: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface Food {
    id: number;
    name: string;
    description?: string;
    price: number;
    discountPercentage: number;
    image?: string;
    categoryId: number;
    status: boolean;
    ingredients?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Cart {
    id: number;
    userId: number;
    foodId: number;
    quantity: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface DiningTable {
    id: number;
    number: string;
    capacity: number;
    status: 'Available' | 'Occupied' | 'Reserved' | 'Cleaning';
    createdAt: Date;
    updatedAt: Date;
}

export interface Session {
    id: number;
    tableId: number;
    startTime: Date;
    endTime?: Date;
    status: 'Open' | 'Closed';
    customerName?: string;
    customerEmail?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Order {
    id: number;
    sessionId: number;
    waiterId: number;
    status: 'Pending' | 'Ready' | 'Served' | 'Paid' | 'Cancelled';
    total: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface OrderItem {
    id: number;
    orderId: number;
    foodId: number;
    quantity: number;
    price: number;
    customizations?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Bill {
    id: number;
    orderId: number;
    amount: number;
    status: 'Unpaid' | 'Paid' | 'Partially Paid';
    paymentMethod?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Supplier {
    id: number;
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    category?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface StockItem {
    id: number;
    name: string;
    quantity: number;
    unit: string;
    category?: string;
    minStock?: number;
    supplierId?: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface Setting {
    id: number;
    key: string;
    value: string;
    updatedAt: Date;
}

export interface Booking {
    id: number;
    tableId?: number;
    name: string;
    email: string;
    phone: string;
    date: Date;
    time: string;
    guests: number;
    status: 'Pending' | 'Confirmed' | 'Cancelled' | 'Seated';
    createdAt: Date;
    updatedAt: Date;
}
