# 🚛 VPL Load Board System — Detailed Summary

## Overview
The VPL Load Board is a comprehensive logistics backend system that enables shippers to post loads, truckers to bid and move loads, and both parties to track shipments in real time. The system is built with Node.js, Express, and MongoDB, and supports robust role-based access, analytics, and automation.

---

## Key Features

### 1. Load Management
- **Shipper can post loads** with detailed info (origin, destination, weight, commodity, vehicle type, pickup/delivery dates, rate, etc.)
- **Load status flow:**
  - `Posted` → `Bidding` → `Assigned` → `In Transit` → `Delivered`
  - Loads can be `Cancelled` by shipper before assignment
- **Load update/cancel** endpoints for shippers

### 2. Bidding System
- **Truckers can view and bid** on available loads
- **Bid management:**
  - Place, update, withdraw bids
  - Shipper can accept/reject bids
  - Bid status: `Pending` → `Accepted`/`Rejected`
- **Automatic status update:**
  - Load status changes to `Assigned` when a bid is accepted
  - All other bids for the load are auto-rejected

### 3. Role-Based Access
- **Shipper:** Post/manage loads, view/accept/reject bids on own loads
- **Trucker:** Browse loads, place/update/withdraw bids, view assigned loads
- **Middleware:** Ensures only authorized users can access/modify relevant data

### 4. Filtering, Search, Analytics
- **Advanced filtering** on loads (origin, destination, vehicle type, weight, rate, etc.)
- **Search** for loads
- **Analytics endpoints:**
  - Load/bid statistics, trends, top shippers, popular routes
- **Dashboard** for quick overview

### 5. Notifications
- **Real-time notifications** for new bids, bid status updates, etc.

### 6. Tracking & Trip Management (NEW)
- **Automatic tracking record** created when load is assigned
- **Origin/destination geocoding** (lat/lng) via OpenStreetMap
- **Real-time location update endpoint** for driver/trucker app
- **Status update endpoint** (`in_transit`, `delivered`, etc.)
- **Trip details endpoint** to fetch all tracking info for a load
- **Tracking record includes:**
  - `originLatLng`, `destinationLatLng`
  - `currentLocation` (live updated)
  - `status` (in_transit, delivered, pending)
  - `shipmentNumber`, `vehicleNumber`
  - `startedAt`, `endedAt`

### 7. Automation
- **Scripts for meeting reminders, unverified account cleanup, etc.**

### 8. Documentation
- **API documentation** and **roles guide** included in the project

---

## Main API Endpoints

### Load Board
- `GET /api/v1/loadboard/dashboard` — Dashboard data, stats, top shippers, popular routes
- `GET /api/v1/loadboard/filters` — Filter options
- `GET /api/v1/loadboard/analytics` — Analytics/trends
- `GET /api/v1/loadboard/notifications` — User notifications

### Loads
- `POST /api/v1/load/create` — Create new load (shipper)
- `GET /api/v1/load/available` — Browse available loads (trucker)
- `GET /api/v1/load/search` — Search loads
- `GET /api/v1/load/:id` — Load details
- `PUT /api/v1/load/:id/status` — Update load status
- `DELETE /api/v1/load/:id` — Cancel load

### Bids
- `POST /api/v1/bid/place` — Place bid (trucker)
- `PUT /api/v1/bid/:bidId/status` — Accept/reject bid (shipper)
- `GET /api/v1/bid/load/:loadId` — All bids for a load (shipper)
- `GET /api/v1/bid/trucker` — All bids by trucker
- `DELETE /api/v1/bid/:bidId` — Withdraw bid

### Tracking/Trip
- `POST /api/v1/load/:loadId/location` — Update real-time location (driver/trucker app)
- `POST /api/v1/load/:loadId/status` — Update trip status (in_transit, delivered, etc.)
- `GET /api/v1/load/:loadId/trip` — Get trip/tracking details

---

## Data Models (Key Fields)

### Load
- Shipper, origin, destination, weight, commodity, vehicleType, pickupDate, deliveryDate, rate, status, assignedTo, acceptedBid, shipmentNumber, etc.

### Bid
- Load, carrier, rate, status, driver/vehicle info, timestamps, etc.

### Tracking
- load, originLatLng, destinationLatLng, currentLocation, status, shipmentNumber, vehicleNumber, startedAt, endedAt

---

## Security & Access
- All endpoints protected by authentication
- Role-based access for sensitive actions
- Data validation and error handling throughout

---

## Conclusion
The VPL Load Board backend is a robust, production-ready system supporting the full logistics workflow: load posting, bidding, assignment, real-time tracking, and analytics. All major business flows and integrations are covered, and the system is ready for frontend/app integration and real-world deployment. 