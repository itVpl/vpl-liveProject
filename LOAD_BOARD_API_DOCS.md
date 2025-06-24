# Load Board API Documentation

## Overview
The Load Board system allows shippers to post loads and truckers to bid on them. This creates a marketplace where loads can be efficiently matched with carriers.

## Features
- ✅ Shipper load posting with detailed specifications
- ✅ Trucker bidding system with rate negotiation
- ✅ Advanced filtering and search capabilities
- ✅ Real-time notifications
- ✅ Analytics and statistics
- ✅ Load status tracking
- ✅ Bid management

## API Endpoints

### Load Board Dashboard

#### GET `/api/v1/loadboard/dashboard`
Get the main load board dashboard with loads, statistics, and filters.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 10)
- `originCity` (string): Filter by origin city
- `destinationCity` (string): Filter by destination city
- `vehicleType` (string): Filter by vehicle type
- `minWeight` (number): Minimum weight filter
- `maxWeight` (number): Maximum weight filter
- `minRate` (number): Minimum rate filter
- `maxRate` (number): Maximum rate filter
- `sortBy` (string): Sort field (default: 'createdAt')
- `sortOrder` (string): Sort order 'asc' or 'desc' (default: 'desc')

**Response:**
```json
{
  "success": true,
  "loads": [...],
  "pagination": {
    "totalPages": 5,
    "currentPage": 1,
    "totalLoads": 50
  },
  "statistics": {
    "totalLoads": 100,
    "postedLoads": 30,
    "biddingLoads": 20,
    "assignedLoads": 50,
    "totalBids": 150,
    "pendingBids": 45
  },
  "topShippers": [...],
  "popularRoutes": [...]
}
```

#### GET `/api/v1/loadboard/filters`
Get available filter options for the load board.

**Response:**
```json
{
  "success": true,
  "filters": {
    "originCities": ["New York", "Los Angeles", "Chicago"],
    "destinationCities": ["Miami", "Seattle", "Denver"],
    "vehicleTypes": ["Truck", "Trailer", "Container"],
    "commodities": ["Electronics", "Food", "Machinery"],
    "rateRange": { "minRate": 500, "maxRate": 5000 },
    "weightRange": { "minWeight": 1000, "maxWeight": 50000 }
  }
}
```

#### GET `/api/v1/loadboard/analytics`
Get load board analytics and trends.

**Query Parameters:**
- `period` (number): Days to analyze (default: 30)

**Response:**
```json
{
  "success": true,
  "analytics": {
    "loadStatsByStatus": [...],
    "loadStatsByVehicleType": [...],
    "bidStats": [...],
    "avgRateByVehicleType": [...],
    "dailyLoadTrend": [...]
  }
}
```

#### GET `/api/v1/loadboard/notifications`
Get user notifications (requires authentication).

**Response:**
```json
{
  "success": true,
  "notifications": [
    {
      "type": "new_bid",
      "message": "New bid received from ABC Trucking",
      "data": {...},
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ],
  "unreadCount": 3
}
```

### Load Management

#### POST `/api/v1/load/create`
Create a new load (requires authentication).

**Request Body:**
```json
{
  "fromCity": "New York",
  "fromState": "NY",
  "fromZipCode": "10001",
  "fromAddress": "123 Main St",
  "fromContactPerson": "John Doe",
  "fromContactPhone": "555-1234",
  "toCity": "Los Angeles",
  "toState": "CA",
  "toZipCode": "90210",
  "toAddress": "456 Oak Ave",
  "toContactPerson": "Jane Smith",
  "toContactPhone": "555-5678",
  "weight": 5000,
  "commodity": "Electronics",
  "vehicleType": "Truck",
  "pickupDate": "2024-01-20T10:00:00Z",
  "deliveryDate": "2024-01-25T18:00:00Z",
  "rate": 2500,
  "rateType": "Flat Rate",
  "specialRequirements": "Temperature controlled",
  "hazmat": false,
  "temperatureControlled": true,
  "liftgateRequired": false,
  "insideDelivery": true,
  "appointmentRequired": true,
  "bidDeadline": "2024-01-18T23:59:59Z",
  "isUrgent": false
}
```

#### GET `/api/v1/load/available`
Get all available loads for truckers (public route).

**Query Parameters:** Same as dashboard

#### GET `/api/v1/load/search`
Search loads by keyword (public route).

**Query Parameters:**
- `q` (string): Search query

#### GET `/api/v1/load/shipper`
Get loads posted by authenticated shipper.

#### GET `/api/v1/load/trucker`
Get loads assigned to authenticated trucker.

#### GET `/api/v1/load/:id`
Get detailed information about a specific load (public route).

#### PUT `/api/v1/load/:id/status`
Update load status (requires authentication).

**Request Body:**
```json
{
  "status": "In Transit"
}
```

#### DELETE `/api/v1/load/:id`
Cancel a load (requires authentication, shipper only).

### Bid Management

#### POST `/api/v1/bid/place`
Place a bid on a load (requires authentication).

**Request Body:**
```json
{
  "loadId": "load_id_here",
  "rate": 2300,
  "message": "I can pick up tomorrow and deliver on time",
  "estimatedPickupDate": "2024-01-21T08:00:00Z",
  "estimatedDeliveryDate": "2024-01-24T16:00:00Z"
}
```

#### PUT `/api/v1/bid/:bidId`
Update an existing bid (requires authentication).

**Request Body:** Same as place bid

#### GET `/api/v1/bid/load/:loadId`
Get all bids for a specific load (requires authentication, shipper only).

#### PUT `/api/v1/bid/:bidId/status`
Accept or reject a bid (requires authentication, shipper only).

**Request Body:**
```json
{
  "status": "Accepted",
  "reason": "Best rate and timing"
}
```

#### GET `/api/v1/bid/trucker`
Get all bids placed by authenticated trucker.

#### DELETE `/api/v1/bid/:bidId`
Withdraw a bid (requires authentication).

#### GET `/api/v1/bid/stats`
Get bid statistics (public route).

## Data Models

### Load Model
```javascript
{
  shipper: ObjectId, // Reference to ShipperDriver
  origin: {
    city: String,
    state: String,
    zipCode: String,
    address: String,
    contactPerson: String,
    contactPhone: String
  },
  destination: {
    city: String,
    state: String,
    zipCode: String,
    address: String,
    contactPerson: String,
    contactPhone: String
  },
  weight: Number,
  commodity: String,
  vehicleType: String, // Truck, Trailer, Container, etc.
  pickupDate: Date,
  deliveryDate: Date,
  rate: Number,
  rateType: String, // Per Mile, Flat Rate, Per Hundred Weight
  specialRequirements: String,
  hazmat: Boolean,
  temperatureControlled: Boolean,
  liftgateRequired: Boolean,
  insideDelivery: Boolean,
  appointmentRequired: Boolean,
  status: String, // Posted, Bidding, Assigned, In Transit, Delivered, Cancelled
  assignedTo: ObjectId, // Reference to ShipperDriver (trucker)
  acceptedBid: ObjectId, // Reference to Bid
  bidDeadline: Date,
  isUrgent: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Bid Model
```javascript
{
  load: ObjectId, // Reference to Load
  carrier: ObjectId, // Reference to ShipperDriver (trucker)
  rate: Number,
  message: String,
  estimatedPickupDate: Date,
  estimatedDeliveryDate: Date,
  status: String, // Pending, Accepted, Rejected
  rejectionReason: String,
  acceptedAt: Date,
  rejectedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## Authentication
Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Error Responses
All endpoints return consistent error responses:
```json
{
  "success": false,
  "message": "Error description"
}
```

## Status Codes
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

## Usage Examples

### For Shippers:
1. Register as a shipper
2. Post loads with detailed specifications
3. Review bids from truckers
4. Accept or reject bids
5. Track load status

### For Truckers:
1. Register as a trucker
2. Browse available loads
3. Place bids with competitive rates
4. Track bid status
5. Manage assigned loads

## Rate Limiting
- 100 requests per minute per IP for public endpoints
- 1000 requests per minute per authenticated user

## WebSocket Support (Future)
Real-time notifications for:
- New bids on shipper loads
- Bid status updates for truckers
- Load status changes
- New load postings 