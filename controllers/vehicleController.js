import { Location } from '../models/locationModel.js';

export const getVehicleByNumber = async (req, res) => {
  const { vehicleNo } = req.query;
  if (!vehicleNo) {
    return res.status(400).json({ error: 'Vehicle number is required' });
  }
  try {
    const vehicle = await Location.findOne({ vehicleNo }).select('vehicleNo latitude longitude');
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.json(vehicle);
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message });
  }
}; 