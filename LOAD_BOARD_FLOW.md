# 🚛 VPL Load Board — Complete Functional Flow

---

## 1. Roles
- **Shipper:** Posts loads, manages bids, assigns loads
- **Trucker:** Browses loads, places bids, manages assigned loads
- **Employee/Ops:** Internally approves bids and documents before final assignment

---

## 2. Load Creation (By Shipper)
- **API:** `POST /api/v1/load/create`
- **Fields:**
  - Common: fromCity, fromState, toCity, toState, weight, commodity, vehicleType, pickupDate, deliveryDate, rate, rateType, bidDeadline, containerNo, poNumber, bolNumber
  - `loadType`: 'OTR' or 'DRAYAGE'
  - If `loadType` is 'DRAYAGE': also require `returnDate`, `returnLocation`
- **Business Rule:**
  - All required fields must be provided as per load type
  - Load is posted and visible to truckers for bidding

---

## 3. Bidding (By Trucker)
- **API:** `POST /api/v1/bid/place`
- **Fields:** loadId, rate, message, estimatedPickupDate, estimatedDeliveryDate
- **Business Rule:**
  - Trucker can only bid on available loads
  - Each trucker can place only one bid per load

---

## 4. Bid Management (By Shipper)
- **View Bids:** `GET /api/v1/bid/load/:loadId`
- **Accept/Reject Bid:** `PUT /api/v1/bid/:bidId/status` (form-data, can upload DO document)
  - Fields: status ('Accepted' or 'Rejected'), reason, shipmentNumber, poNumber, bolNumber, doDocument (file)
- **Business Rule:**
  - When shipper accepts a bid:
    - Bid status becomes `PendingApproval` (not 'Accepted' yet)
    - DO document and details are saved, but not visible to trucker
    - All other bids for the load are auto-rejected
  - When shipper rejects a bid:
    - Bid status becomes 'Rejected'

---

## 5. Internal Approval (By Employee/Ops)
- **API:** `PUT /api/v1/bid/:bidId/approve`
- **Business Rule:**
  - Employee reviews bid, DO document, and details
  - On approval:
    - Bid status becomes 'Accepted'
    - `opsApproved` is set to true
    - Trucker can now see shipmentNumber, poNumber, bolNumber, doDocument

---

## 6. Trucker Assignment & Tracking
- **After ops approval:**
  - Load is assigned to the trucker (load.assignedTo)
  - Tracking record is auto-created (origin/destination geocoded)
- **APIs:**
  - `POST /api/v1/load/:loadId/location` — Trucker/driver updates real-time location
  - `POST /api/v1/load/:loadId/status` — Trucker/driver updates trip status (in_transit, delivered, etc.)
  - `GET /api/v1/load/:loadId/trip` — Get all trip/tracking details

---

## 7. Status Updates & Completion
- **Load status flow:**
  - Posted → Bidding → PendingApproval → Accepted (after ops) → Assigned → In Transit → Delivered
- **Bid status flow:**
  - PendingApproval (after shipper accepts) → Accepted (after ops) → Rejected
- **Tracking:**
  - Real-time updates via app/API
  - Trip ends when status is set to 'delivered'

---

## 8. Analytics, Dashboard, and Notifications
- **Dashboard:** `/api/v1/loadboard/dashboard` — Stats, top shippers, popular routes
- **Filters:** `/api/v1/loadboard/filters` — For searching loads
- **Analytics:** `/api/v1/loadboard/analytics` — Trends, stats
- **Notifications:** `/api/v1/loadboard/notifications` — Real-time updates for users

---

## 9. Security & Access
- All APIs require authentication
- Role-based access for shipper, trucker, and employee/ops
- File uploads (DO document) are validated and stored securely

---

## 10. Key Business Rules (Summary)
- **DRAYAGE loads** require returnDate and returnLocation
- **Bid is not fully accepted until internal approval**
- **Trucker only sees sensitive details after ops approval**
- **All actions are logged and validated for security**

---

> **This flow covers the end-to-end business logic and technical process for the VPL Load Board system. For API details, refer to the API documentation.** 