import Bid from "../models/bidModel.js";
import { Load } from "../models/loadModel.js";

// ✅ Carrier places a bid
export const placeBid = async (req, res, next) => {
    try {
      const { loadId, rate, message } = req.body;
  
      const bid = new Bid({
        load: loadId,
        carrier: req.user._id,
        rate,
        message,
      });
  
      await bid.save();
  
      res.status(201).json({
        success: true,
        message: 'Bid placed successfully',
        bid,
      });
    } catch (error) {
      next(error);
    }
  };
  
  // ✅ Shipper views all bids for a load
  export const getBidsForLoad = async (req, res, next) => {
    try {
      const bids = await Bid.find({ load: req.params.loadId })
        .populate('carrier', 'name email');
  
      res.status(200).json({
        success: true,
        bids,
      });
    } catch (error) {
      next(error);
    }
  };
  
  // ✅ Shipper accepts/rejects a bid
  export const updateBidStatus = async (req, res, next) => {
    try {
      const { bidId } = req.params;
      const { status } = req.body; // 'Accepted' or 'Rejected'
  
      const bid = await Bid.findById(bidId).populate('load');
  
      if (!bid) {
        return res.status(404).json({ success: false, message: 'Bid not found' });
      }
  
      if (status === 'Accepted') {
        // Update bid status
        bid.status = 'Accepted';
        await bid.save();
  
        // Assign load to this carrier
        const load = await Load.findById(bid.load._id);
        load.status = 'Assigned';
        load.assignedTo = bid.carrier;
        await load.save();
  
        // Reject all other bids for same load
        await Bid.updateMany(
          { load: bid.load._id, _id: { $ne: bid._id } },
          { status: 'Rejected' }
        );
      } else {
        bid.status = 'Rejected';
        await bid.save();
      }
  
      res.status(200).json({
        success: true,
        message: `Bid ${status.toLowerCase()} successfully`,
      });
    } catch (error) {
      next(error);
    }
  };