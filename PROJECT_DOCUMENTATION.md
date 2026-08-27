# Shield Pro ERP - Complete Project Documentation

## Executive Summary

**Shield Pro** is a comprehensive Enterprise Resource Planning (ERP) system designed specifically for a tire sealant manufacturing factory (مصنع لواصق الإطارات الجارية). This is a modern, offline-first web application built with React, TypeScript, and follows clean architecture principles with SOLID design patterns.

### Key Business Value
- **Industry-Specific**: Tailored for chemical manufacturing with recipe management, batch production, and inventory tracking
- **Offline-First**: Operates without internet connectivity, syncing data when connection is restored
- **Multi-User**: Role-based access control for different organizational roles
- **CRM Integration**: Client portal for customers to place orders and track deliveries
- **Manufacturing-Ready**: Complete production workflow from raw materials to finished goods

---

## Technology Stack

### Frontend Framework
- **React 18.2.0** - UI library with hooks and functional components
- **TypeScript 5.1.6** - Type-safe JavaScript development
- **Vite 7.3.6** - Fast build tool and development server
- **Framer Motion 12.43.0** - Animation library for smooth UI transitions

### Database & Storage
- **Dexie 4.4.4** - IndexedDB wrapper for offline local storage
- **Supabase 2.110.7** - Backend-as-a-Service for remote database and authentication
- **PostgreSQL** - Primary database (via Supabase)

### UI & Styling
- **Tailwind CSS 4.3.3** - Utility-first CSS framework
- **Lucide React 1.25.0** - Icon library
- **Leaflet 1.9.4** - Mapping library for GPS tracking
- **React Leaflet 4.2.1** - React integration for Leaflet

### Additional Libraries
- **ZXing 0.2.1/0.23.0** - Barcode scanning and generation
- **Postgres 8.22.0/3.4.9** - PostgreSQL client libraries

### Development Tools
- **ESLint 8.57.1** - Code quality and linting
- **Vitest 4.1.10** - Unit testing framework
- **Vite PWA Plugin 1.3.0** - Progressive Web App capabilities

---

## Architecture Overview

### Clean Architecture Implementation

The project follows a strict clean architecture pattern with clear separation of concerns:

```
src/
├── core/                    # Core business logic and domain models
│   ├── domain/             # Domain entities and value objects
│   ├── interfaces/         # Abstract interfaces (repositories, services)
│   └── types/              # Shared TypeScript types
├── infrastructure/         # External dependencies implementation
│   ├── database/           # Dexie implementation details
│   ├── sync/               # Sync logic
│   └── api/                # Supabase client
├── application/            # Application services and use cases
│   ├── services/           # Business logic services
│   └── hooks/              # Custom React hooks
├── presentation/           # UI components
│   ├── components/         # React components
│   └── pages/              # Page components
└── shared/                 # Shared utilities
    ├── utils/              # Helper functions
    └── constants/          # Constants
```

### SOLID Principles Applied

#### 1. Single Responsibility Principle (SRP)
- Each class has a single, well-defined responsibility
- Repositories handle data access only
- Services handle business logic only
- Components handle UI rendering only

#### 2. Open/Closed Principle (OCP)
- Abstract interfaces allow extension without modification
- New repositories can be added without changing existing code
- Configuration-driven behavior (e.g., sequence prefixes)

#### 3. Liskov Substitution Principle (LSP)
- All repository implementations can be substituted with their interfaces
- Base repository provides common functionality for all entities

#### 4. Interface Segregation Principle (ISP)
- Specific interfaces for each domain area
- Clients depend only on methods they use

#### 5. Dependency Inversion Principle (DIP)
- High-level modules (services) depend on abstractions (interfaces)
- Low-level modules (repositories) implement abstractions
- Dependency injection via factory pattern

### Design Patterns

#### Repository Pattern
- Abstracts data access logic
- Provides domain-oriented data access
- Implements pagination and filtering
- Located in `infrastructure/database/repositories/`

#### Factory Pattern
- ServiceFactory for service instances
- RepositoryFactory for repository instances
- Centralized object creation and lifecycle management

#### Strategy Pattern
- Different sync strategies for different scenarios
- Pluggable sequence generation strategies

#### Observer Pattern
- Sync state subscribers
- React hooks for state management

#### Facade Pattern
- Service layer provides simplified interfaces
- Hides complexity of underlying operations

#### Singleton Pattern
- Factory instances are singletons
- Ensures consistent state across application

---

## Business Modules & Functionality

### 1. Dashboard Module
**Purpose**: Central overview of business metrics and KPIs

**Key Features**:
- Today's sales figures
- Cash and bank liquidity
- Low stock alerts
- Pending sync operations count
- Permission-based card visibility

**Technical Implementation**:
- `DashboardService` aggregates data from multiple repositories
- Real-time calculations using repository methods
- Permission-based UI rendering using `checkPermission()`

### 2. Sales & Customers Module
**Purpose**: Manage sales operations, customer relationships, and revenue tracking

**Key Features**:
- Customer management with CRM integration
- Sales invoice creation with automatic stock deduction
- Receipt voucher processing for payments
- Customer statement of account generation
- Barcode scanning for quick item entry
- Client ID generation for CRM portal access

**Business Logic**:
- Automatic journal entries for cash/credit sales
- Stock movement generation on invoice creation
- Invoice status tracking (unpaid, partially paid, paid, cancelled)
- VAT calculation support
- Customer credit limit monitoring

**CRM Integration**:
- Auto-generated client IDs (format: CLI-XXXXXXXX)
- Client portal authentication using client ID only
- WhatsApp sharing of client credentials
- Customer financial summary tracking

### 3. Purchases & Suppliers Module
**Purpose**: Manage procurement operations and supplier relationships

**Key Features**:
- Supplier management
- Purchase invoice creation
- Payment voucher processing
- Stock receipt tracking
- Supplier account statements

**Business Logic**:
- Automatic stock addition on purchase
- Accounts payable tracking
- Supplier credit management
- Purchase return processing

### 4. Inventory & Warehouse Module
**Purpose**: Manage stock levels, warehouses, and inventory movements

**Key Features**:
- Multi-warehouse support
- Item categorization (raw materials, packaging, intermediate, finished goods)
- Barcode scanning support (unit and carton barcodes)
- Stock movement tracking
- Low stock alerts and reorder points
- Unit conversion management

**Business Logic**:
- Real-time stock calculation
- Automatic reorder level monitoring
- Expiry date tracking support
- Batch number tracking for traceability

### 5. Manufacturing Module
**Purpose**: Manage production workflows from raw materials to finished goods

**Key Features**:
- Recipe/BOM management (batch and packaging stages)
- Production batch creation and tracking
- Raw material consumption calculation
- Waste percentage tracking
- Two-stage production process:
  1. **Batch Production**: Raw material mixing for intermediate products
  2. **Packaging/Filling**: Converting bulk liquid to finished goods

**Business Logic**:
- Recipe modes: percentage-based or fixed quantity
- Automatic material requirement calculation
- Production consumption and output stock movements
- Expiry date tracking for batches
- Cost analysis per unit

**Production Workflow**:
1. Define recipe for intermediate product (batch stage)
2. Create production order with planned quantity
3. Confirm batch to deduct raw materials and add intermediate product
4. Define packaging recipe for finished goods
5. Execute filling order to convert bulk to packaged goods

### 6. Accounting & Finance Module
**Purpose**: Manage financial operations, double-entry bookkeeping, and reporting

**Key Features**:
- Chart of accounts management
- Double-entry journal entries
- Account transaction tracking
- Cash and bank balance monitoring
- Fixed assets registration
- Operating expenses tracking
- Profit and loss calculation
- Liquidity and capital analysis

**Business Logic**:
- Automatic double-entry posting for:
  - Sales invoices (debit cash/AR, credit revenue)
  - Receipt vouchers (debit cash, credit AR)
  - Payment vouchers (debit AP, credit cash)
  - Purchase invoices (debit expense, credit AP)
  - Payroll runs (debit salary expense, credit cash)
  - Fixed assets (debit assets, credit capital)
  - Operating expenses (debit expense, credit cash)

**Account Categories**:
- Cash, Bank, Capital, Fixed Assets
- Accounts Receivable (AR), Accounts Payable (AP)
- Revenue, Cost of Goods Sold (COGS), Expense

**Financial Calculations**:
- Real-time liquidity: Cash + Bank + AR - AP + Inventory + Fixed Assets
- Working capital monitoring
- Account balance calculations
- Profit and loss by date range

### 7. Human Resources Module
**Purpose**: Manage employee records, attendance, and payroll

**Key Features**:
- Employee profile management
- System user account linking
- Attendance tracking (check-in/check-out)
- Monthly payroll processing
- Task assignment and tracking
- Employee reports and complaints
- Bonus and punishment management

**Business Logic**:
- Payroll calculation: Base salary + allowances - deductions
- Automatic journal entry for payroll (debit salary expense, credit cash)
- Attendance record validation
- Employee-performance tracking through tasks and reports

**Task Management**:
- Task assignment to employees
- Priority levels (low, medium, high, urgent)
- Status tracking (not started, in progress, done, cancelled)
- Feedback and completion tracking

### 8. Reports & Analytics Module
**Purpose**: Generate business reports and performance analytics

**Key Features**:
- Sales reports by date range
- Inventory valuation reports
- Profit and loss statements
- Customer aging reports
- Supplier performance reports
- Production efficiency reports

### 9. Users & Devices Module
**Purpose**: Manage system users, roles, and device tracking

**Key Features**:
- User management with role assignment
- Role-based permission system
- Device and session tracking
- User activity monitoring
- App version tracking
- Last seen timestamps

**Permission System**:
- Module-based permissions (sales, purchases, inventory, etc.)
- Action-based permissions (view, add, edit, delete)
- Master Admin role with full access
- Client Portal role for CRM access

### 10. GPS Tracking Module
**Purpose**: Track field representatives and delivery personnel

**Key Features**:
- Real-time location tracking
- Map visualization using Leaflet
- Location history
- Geofencing capabilities
- Route tracking

**Technical Implementation**:
- GPS location pings stored in `user_locations` table
- Foreground-only location tracking
- Location data synced with offline queue
- Map integration with React Leaflet

### 11. CRM Client Portal
**Purpose**: Provide customers with self-service capabilities

**Key Features**:
- Client ID-only authentication (no password required)
- Order placement and tracking
- Invoice viewing and download
- Delivery status updates
- Financial summary viewing
- Real-time notifications
- Order history and statements

**Authentication Flow**:
1. Admin creates customer in ERP with auto-generated client ID
2. Admin creates Supabase auth user with password = client ID
3. Admin links auth user to customer record
4. Customer logs in using only client ID
5. System authenticates using linked user account

**Portal Features**:
- Dashboard with financial summary
- Order management (create, view, track)
- Invoice viewing and downloading
- Delivery tracking
- Notification system
- Profile management

---

## Data Architecture

### Database Schema (Supabase/PostgreSQL)

#### Core Tables

**Users & Authentication**
- `users` - System user profiles with role assignments
- `roles` - User roles (Master Admin, Manager, Worker, Client Portal)
- `permissions` - Granular permissions by module and action
- `role_permissions` - Role-permission mapping

**Inventory Management**
- `items` - Product catalog with barcode support
- `units` - Unit of measurement definitions
- `unit_conversions` - Unit conversion factors
- `warehouses` - Storage locations
- `stock_movements` - All inventory transactions
- `item_recipes` - BOM/Recipe definitions for manufacturing

**Sales & CRM**
- `customers` - Customer profiles with CRM credentials
- `sales_invoices` - Sales invoice headers
- `sales_invoice_lines` - Sales invoice line items
- `sales_returns` - Sales return headers
- `sales_return_lines` - Sales return line items
- `receipt_vouchers` - Payment receipt vouchers
- `crm_orders` - CRM portal orders
- `crm_order_lines` - CRM order line items
- `client_notifications` - Customer notifications
- `client_financial_summary` - Customer financial aggregates

**Purchasing**
- `suppliers` - Supplier profiles
- `purchase_invoices` - Purchase invoice headers
- `purchase_invoice_lines` - Purchase invoice line items
- `payment_vouchers` - Payment vouchers to suppliers

**Accounting**
- `accounts` - Chart of accounts
- `account_transactions` - Journal entries
- `fixed_assets` - Fixed asset register
- `expenses` - Operating expenses

**Manufacturing**
- `production_batches` - Production batch records
- `production_consumptions` - Material consumption records

**Human Resources**
- `employees` - Employee profiles
- `attendance` - Attendance records
- `payroll_runs` - Payroll processing records
- `tasks` - Task assignments
- `employee_reports` - Employee complaints/reports
- `bonuses` - Employee bonuses
- `punishments` - Employee deductions

**System**
- `settings` - Application settings
- `audit_log` - Change tracking and audit trail
- `user_locations` - GPS location tracking
- `offline_queue` - Offline operation queue (local only)

### Offline Storage (Dexie/IndexedDB)

The local database mirrors the remote schema with additional sync tables:
- `offline_queue` - Queued operations for sync
- All business tables for offline access
- Indexed queries for performance

---

## Sync & Offline Architecture

### Offline-First Strategy

The application is designed to work seamlessly without internet connectivity:

**Data Flow**:
1. **Write Operation**: Data is written to local Dexie database immediately
2. **Queue Operation**: Operation is added to offline queue
3. **Sync Trigger**: If online, sync is triggered immediately
4. **Conflict Resolution**: Server data takes precedence, pending writes are preserved
5. **Audit Trail**: All operations are logged for audit purposes

### Sync Service Implementation

**Key Components**:
- `SyncService` - Manages sync state and operations
- `queueOfflineWrite()` - Queues operations for sync
- `triggerSync()` - Pushes local changes to server
- `pullFromServer()` - Pulls server changes locally
- `SequenceGenerator` - Generates sequence numbers for documents

**Sync Strategies**:
- **Push Strategy**: Uploads queued operations when online
- **Pull Strategy**: Downloads server changes periodically
- **Conflict Resolution**: Server-side data wins for conflicts
- **Retry Logic**: Failed operations are retried automatically

**Sequence Number Generation**:
- Pending numbers generated locally (e.g., PENDING-INV-1234567890)
- Final numbers assigned by server during sync
- Prefix-based numbering (INV-, PUR-, REC-, BAT-, etc.)

### Performance Optimizations

**Pagination**:
- All repository methods support pagination
- Configurable page sizes with upper limits
- Efficient database queries with offset/limit

**Virtual Scrolling**:
- VirtualList component for large datasets
- Renders only visible items
- Reduces DOM nodes and improves performance

**Caching**:
- LRU cache implementation for frequently accessed data
- Configurable cache sizes per data type
- Automatic cache eviction

**Memoization**:
- React hooks use useCallback and useMemo
- Prevents unnecessary re-renders
- Optimizes expensive computations

---

## Authentication & Authorization

### Authentication System

**Supabase Authentication**:
- Email/password authentication for internal users
- Client ID-only authentication for CRM portal
- Session management with automatic refresh
- Offline session caching

**User Roles**:
- **Master Admin**: Full system access, can manage users and roles
- **Manager**: Access to assigned modules with full permissions
- **Worker**: Limited access to specific operational modules
- **Client Portal**: Access to CRM portal only

### Authorization System

**Permission Matrix**:
- Module-based permissions (sales, purchases, inventory, manufacturing, accounting, hr, reports, user_tracking, gps_tracking, settings)
- Action-based permissions (view, add, edit, delete)
- Permission checks before UI rendering and API calls

**Implementation**:
```typescript
checkPermission(module: string, action: 'view' | 'add' | 'edit' | 'delete'): boolean
```

### CRM Client Authentication

**Client ID Flow**:
1. Customer receives client ID (e.g., CLI-ABC12345)
2. Customer enters only client ID to log in
3. System looks up customer by client ID
4. Authenticates using linked Supabase user (password = client ID)
5. Creates session and redirects to CRM dashboard

**Security Features**:
- Revocable access (set customer.is_active = false)
- Unique client IDs per customer
- No password management for customers
- Admin-controlled account creation

---

## Business Processes

### Sales Process Flow

1. **Customer Creation**:
   - Enter customer details
   - System generates client ID
   - Optional: Create CRM portal access

2. **Invoice Creation**:
   - Select customer and warehouse
   - Add items with quantities (scan or select)
   - Apply discounts and VAT
   - System generates invoice number
   - Automatic stock deduction
   - Automatic journal entry posting

3. **Payment Collection**:
   - Create receipt voucher
   - Link to invoice (optional)
   - System updates invoice status
   - Automatic journal entry posting

4. **Returns Processing**:
   - Create sales return
   - Add returned items
   - Stock is added back
   - Revenue is reversed

### Manufacturing Process Flow

1. **Recipe Setup**:
   - Define intermediate product recipe (batch stage)
   - Define finished good recipe (packaging stage)
   - Specify quantities (percentage or fixed)

2. **Batch Production**:
   - Create production order
   - System calculates material requirements
   - Confirm batch to deduct materials
   - System adds intermediate product to stock

3. **Packaging Process**:
   - Create filling order
   - System deducts bulk liquid and packaging materials
   - System adds finished goods to stock
   - Generate batch number for traceability

### Payroll Process Flow

1. **Employee Setup**:
   - Create employee profile
   - Set salary, allowances, deductions
   - Link to system user (optional)

2. **Attendance Tracking**:
   - Record daily check-in/check-out
   - System validates no duplicate entries

3. **Payroll Processing**:
   - Select month for payroll
   - System calculates net pay for all employees
   - Automatic journal entry posting
   - Generate payroll reports

### Procurement Process Flow

1. **Supplier Setup**:
   - Create supplier profile
   - Set credit terms and limits

2. **Purchase Order**:
   - Create purchase invoice
   - Add items and quantities
   - System adds stock on receipt
   - Automatic journal entry posting

3. **Supplier Payment**:
   - Create payment voucher
   - Link to purchase invoice
   - System updates supplier balance
   - Automatic journal entry posting

---

## Progressive Web App (PWA) Features

### PWA Configuration

**Manifest**:
- Standalone app mode
- Arabic language support (RTL)
- Custom icons and theme colors
- Offline capability

**Service Worker**:
- Automatic updates
- Asset caching
- Offline fallback
- Network-first strategy for API calls

### Deployment

**Vercel Integration**:
- Automatic deployments from Git
- Environment variable management
- Edge network distribution
- SSL certificates

---

## Development & Build Process

### Build Scripts

```json
{
  "dev": "vite",                    // Development server
  "build": "tsc -b && vite build",  // Production build
  "preview": "vite preview",        // Preview production build
  "lint": "eslint .",               // Code linting
  "lint:fix": "eslint . --fix",     // Auto-fix linting issues
  "test": "vitest run",             // Run tests
  "test:watch": "vitest"            // Watch mode testing
}
```

### Environment Configuration

**Required Environment Variables**:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

**Development**:
- Local development server on port 3000
- Hot module replacement
- TypeScript type checking

**Production**:
- Optimized bundle size
- Code splitting with React.lazy
- PWA minification
- Environment-specific builds

---

## Testing Strategy

### Unit Testing

**Test Coverage**:
- Repository methods with mock database
- Service methods with mock repositories
- Utility functions and helpers
- Custom React hooks

### Integration Testing

**Test Scenarios**:
- Service-repository integration
- Component-service integration
- Sync logic with offline/online scenarios
- Authentication flows

### End-to-End Testing

**User Workflows**:
- Complete sales process
- Manufacturing workflow
- Payroll processing
- CRM portal usage

---

## Security Considerations

### Data Security

- **Authentication**: Supabase auth with session management
- **Authorization**: Role-based access control
- **Audit Trail**: All operations logged in audit_log table
- **Data Validation**: Client-side and server-side validation
- **SQL Injection Prevention**: Parameterized queries via Supabase

### Offline Security

- **Local Storage**: Data encrypted in browser storage
- **Session Management**: Offline session validation
- **Sync Security**: Authenticated sync operations only

### CRM Security

- **Client ID Authentication**: No password exposure
- **Revocable Access**: Instant account deactivation
- **Data Isolation**: Customers see only their data
- **Secure Communication**: HTTPS for all API calls

---

## Performance Monitoring

### Key Metrics

- **Sync Performance**: Time to complete offline queue processing
- **Database Performance**: Query execution times
- **UI Performance**: Render times and interaction responsiveness
- **Memory Usage**: Local storage and memory consumption

### Optimization Strategies

- **Lazy Loading**: Code splitting for large components
- **Virtual Scrolling**: Efficient rendering of large lists
- **Debouncing**: Input field optimization
- **Memoization**: Expensive computation caching

---

## Future Enhancements

### Planned Features

1. **Advanced Analytics**: Business intelligence dashboards
2. **Real-time Updates**: WebSocket support for live data
3. **Advanced Search**: Full-text search capabilities
4. **Mobile App**: Native mobile application
5. **Multi-language**: Support for multiple languages
6. **Advanced Manufacturing**: Production planning and scheduling
7. **Quality Control**: QC testing and certification tracking
8. **Integration APIs**: Third-party system integrations

### Technical Improvements

1. **Performance Monitoring**: APM integration
2. **Error Tracking**: Sentry integration
3. **Advanced Caching**: Redis integration
4. **Database Optimization**: Query optimization and indexing
5. **Microservices**: Service decomposition for scalability

---

## Business Impact

### Operational Efficiency

- **Automated Workflows**: Reduced manual data entry
- **Real-time Visibility**: Live business metrics
- **Process Standardization**: Consistent business processes
- **Error Reduction**: Automated calculations and validations

### Financial Benefits

- **Cost Control**: Expense tracking and budgeting
- **Revenue Optimization**: Sales analytics and customer insights
- **Inventory Optimization**: Reduced stockouts and overstocking
- **Production Efficiency**: Better resource utilization

### Strategic Advantages

- **Data-Driven Decisions**: Comprehensive reporting and analytics
- **Customer Satisfaction**: CRM portal and order tracking
- **Scalability**: Architecture supports business growth
- **Competitive Edge**: Industry-specific features

---

## Conclusion

Shield Pro ERP represents a comprehensive, modern business management solution specifically designed for tire sealant manufacturing. The system combines industry-specific functionality with cutting-edge technology to deliver a powerful, user-friendly platform that addresses the unique challenges of chemical manufacturing businesses.

The clean architecture, offline-first design, and comprehensive business modules make it an ideal solution for manufacturing operations requiring real-time visibility, process automation, and customer relationship management. The system's scalability and extensibility ensure it can grow with the business while maintaining performance and reliability.

---

## Contact & Support

For technical support or feature requests, please refer to the project repository or contact the development team.

---

*This documentation covers the complete Shield Pro ERP system as of the current version. For the most up-to-date information, please refer to the latest codebase and commit history.*