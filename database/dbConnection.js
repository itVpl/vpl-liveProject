import mongoose from "mongoose";

export const connectDB = async () => {
  mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.DB_NAME
    }).then(() => {
      console.log("Database connected successfully");
    }).catch((error) => {
      console.error("Database connection failed:", error.message);
      process.exit(1); // Exit the process with failure
    });

}

// export default connectDB;