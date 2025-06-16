import mongoose from 'mongoose';
const moduleMasterSchema = new mongoose.Schema({
    name: {
      type: String,
      required: true,
      unique: true
    },
    label: String, // Optional: for display like "Load Board"
    icon: String,  // Optional: for frontend icons
    isActive: {
      type: Boolean,
      default: true
    }
  }, { timestamps: true });
  
  const ModuleMaster = mongoose.model('ModuleMaster', moduleMasterSchema);
  export { ModuleMaster };