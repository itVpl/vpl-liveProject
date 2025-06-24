# 🚛 Load Board System - Roles & Permissions Guide

## 📋 **User Roles Overview**

### **🏢 Shipper (Load Poster)**
**Role:** Company that needs to transport goods
**Permissions:**
- ✅ Post loads on the load board
- ✅ View all bids on their loads
- ✅ Accept or reject bids
- ✅ Update load status
- ✅ Cancel loads (before assignment)
- ✅ View load analytics

**Restrictions:**
- ❌ Cannot place bids on loads
- ❌ Cannot view other shippers' loads

### **🚛 Trucker (Carrier)**
**Role:** Company that transports goods
**Permissions:**
- ✅ Browse available loads
- ✅ Place bids on loads
- ✅ Update their bids
- ✅ Withdraw bids
- ✅ View assigned loads
- ✅ Update load status (when assigned)

**Restrictions:**
- ❌ Cannot post loads
- ❌ Cannot view bids on loads they didn't bid on
- ❌ Cannot accept/reject bids

---

## 🔐 **Authentication & Authorization**

### **Middleware Types:**

1. **`isAuthenticatedUser`** - Basic authentication for any user
2. **`isShipper`** - Ensures user is an approved shipper
3. **`isTrucker`** - Ensures user is an approved trucker

### **Account Status Requirements:**
- All users must have `status: 'approved'` to access load board features
- Pending/rejected accounts cannot use the system

---

## 📡 **API Endpoints by Role**

### **🏢 Shipper-Only Endpoints:**

#### **Load Management:**
```
POST /api/v1/load/create          - Create new load
GET  /api/v1/load/shipper         - View own loads
DELETE /api/v1/load/:id           - Cancel load
```

#### **Bid Management:**
```
GET  /api/v1/bid/load/:loadId     - View bids on own loads
PUT  /api/v1/bid/:bidId/status    - Accept/reject bids
```

### **🚛 Trucker-Only Endpoints:**

#### **Load Browsing:**
```
GET  /api/v1/load/available       - Browse available loads
GET  /api/v1/load/search          - Search loads
GET  /api/v1/load/:id             - View load details
GET  /api/v1/load/trucker         - View assigned loads
```

#### **Bid Management:**
```
POST /api/v1/bid/place            - Place bid on load
PUT  /api/v1/bid/:bidId           - Update own bid
GET  /api/v1/bid/trucker          - View own bids
DELETE /api/v1/bid/:bidId         - Withdraw bid
```

### **🌐 Public Endpoints (No Auth Required):**
```
GET /api/v1/load/available        - Browse loads
GET /api/v1/load/search           - Search loads
GET /api/v1/load/:id              - View load details
GET /api/v1/load/stats            - Load statistics
GET /api/v1/bid/stats             - Bid statistics
GET /api/v1/loadboard/dashboard   - Load board dashboard
GET /api/v1/loadboard/filters     - Available filters
GET /api/v1/loadboard/analytics   - Analytics data
```

### **🔓 Shared Endpoints (Both Roles):**
```
PUT /api/v1/load/:id/status       - Update load status
GET /api/v1/loadboard/notifications - View notifications
```

---

## 🚫 **Error Messages by Role**

### **Shipper Trying Trucker Actions:**
```json
{
  "success": false,
  "message": "Only truckers can perform this action"
}
```

### **Trucker Trying Shipper Actions:**
```json
{
  "success": false,
  "message": "Only shippers can perform this action"
}
```

### **Unapproved Account:**
```json
{
  "success": false,
  "message": "Your account is pending. Please wait for approval."
}
```

---

## 🔄 **Complete Workflow**

### **For Shippers:**
1. **Register** as shipper (`userType: 'shipper'`)
2. **Wait for approval** (admin must approve)
3. **Post load** with detailed specifications
4. **Receive bids** from truckers
5. **Review bids** and select best option
6. **Accept bid** to assign load
7. **Track delivery** status

### **For Truckers:**
1. **Register** as trucker (`userType: 'trucker'`)
2. **Wait for approval** (admin must approve)
3. **Browse loads** on load board
4. **Place competitive bids** on suitable loads
5. **Wait for bid response** from shipper
6. **If accepted**, transport the load
7. **Update status** during delivery

---

## 🧪 **Testing Scenarios**

### **Test Case 1: Shipper Posting Load**
```bash
# Login as shipper
POST /api/v1/shipper_driver/login
{
  "email": "shipper@example.com",
  "password": "password123"
}

# Post load (should work)
POST /api/v1/load/create
Authorization: Bearer <shipper_token>
{
  "fromCity": "Mumbai",
  "toCity": "Delhi",
  "weight": 5000,
  "commodity": "Electronics",
  "rate": 25000
}
```

### **Test Case 2: Trucker Trying to Post Load**
```bash
# Login as trucker
POST /api/v1/shipper_driver/login
{
  "email": "trucker@example.com",
  "password": "password123"
}

# Try to post load (should fail)
POST /api/v1/load/create
Authorization: Bearer <trucker_token>
{
  "fromCity": "Mumbai",
  "toCity": "Delhi",
  "weight": 5000
}
# Response: "Only shippers can perform this action"
```

### **Test Case 3: Trucker Bidding on Load**
```bash
# Browse loads (public)
GET /api/v1/load/available

# Place bid (should work)
POST /api/v1/bid/place
Authorization: Bearer <trucker_token>
{
  "loadId": "load_id_here",
  "rate": 23000,
  "message": "I can deliver on time"
}
```

### **Test Case 4: Shipper Accepting Bid**
```bash
# View bids on own load
GET /api/v1/bid/load/load_id_here
Authorization: Bearer <shipper_token>

# Accept bid
PUT /api/v1/bid/bid_id_here/status
Authorization: Bearer <shipper_token>
{
  "status": "Accepted",
  "reason": "Best rate and timing"
}
```

---

## 🔧 **Registration Examples**

### **Shipper Registration:**
```json
{
  "userType": "shipper",
  "compName": "ABC Electronics Ltd",
  "mc_dot_no": "MC123456",
  "carrierType": "Shipper",
  "fleetsize": 0,
  "compAdd": "123 Tech Park, Mumbai",
  "country": "India",
  "state": "Maharashtra",
  "city": "Mumbai",
  "zipcode": "400001",
  "phoneNo": "9876543210",
  "email": "shipper@abcelectronics.com",
  "password": "securepassword123"
}
```

### **Trucker Registration:**
```json
{
  "userType": "trucker",
  "compName": "XYZ Transport Services",
  "mc_dot_no": "MC789012",
  "carrierType": "Carrier",
  "fleetsize": 25,
  "compAdd": "456 Transport Hub, Delhi",
  "country": "India",
  "state": "Delhi",
  "city": "Delhi",
  "zipcode": "110001",
  "phoneNo": "9876543211",
  "email": "trucker@xyztransport.com",
  "password": "securepassword123"
}
```

---

## 📊 **Status Flow**

### **Load Status Flow:**
```
Posted → Bidding → Assigned → In Transit → Delivered
   ↓
Cancelled (if cancelled by shipper)
```

### **Bid Status Flow:**
```
Pending → Accepted (by shipper)
   ↓
Rejected (by shipper)
```

### **User Status Flow:**
```
pending → approved (by admin)
   ↓
rejected (by admin)
```

This system ensures proper role separation and maintains the integrity of the load board marketplace! 