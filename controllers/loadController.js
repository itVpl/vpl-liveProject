import { Load } from '../models/loadModel.js';

// ✅ Shipper creates a new load
// export const createLoad = async (req, res, next) => {
//     try {
//         const newLoad = new Load({
//             ...req.body,
//             shipper: req.user._id, // authenticated shipper user
//         });

//         await newLoad.save();

//         res.status(201).json({
//             success: true,
//             message: 'Load created successfully',
//             load: newLoad,
//         });
//     } catch (error) {
//         next(error);
//     }
// };


export const createLoad = async (req, res, next) => {
    try {
        const { fromCity, toCity, weight, commodity, vehicleType } = req.body;

        const newLoad = new Load({
            shipper: req.user._id,
            origin: { city: fromCity },
            destination: { city: toCity },
            weight,
            commodity,
            vehicleType
        });

        await newLoad.save();

        res.status(201).json({
            success: true,
            message: 'Load created successfully',
            load: newLoad,
        });
    } catch (error) {
        next(error);
    }
};


// ✅ Truckers view all available loads
export const getAvailableLoads = async (req, res, next) => {
    try {
        const loads = await Load.find({ status: 'Posted' })
            .populate('shipper', 'name email');

        res.status(200).json({
            success: true,
            loads,
        });
    } catch (error) {
        next(error);
    }
};

export const getAllLoads = async (req, res, next) => {
    try {
        const loads = await Load.find()
            .populate('shipper', 'name email')
            .populate('assignedTo', 'name email');

        res.status(200).json({ success: true, loads });
    } catch (error) {
        next(error);
    }
};


// ✅ Trucker assigns a load to themselves
export const assignLoad = async (req, res, next) => {
    try {
        const load = await Load.findById(req.params.id);

        if (!load) {
            return res.status(404).json({
                success: false,
                message: 'Load not found',
            });
        }

        // Assign only if it's not already assigned
        if (load.status !== 'Posted') {
            return res.status(400).json({
                success: false,
                message: 'Load is not available for assignment',
            });
        }

        load.status = 'Assigned';
        load.assignedTo = req.user._id;

        await load.save();

        res.status(200).json({
            success: true,
            message: 'Load assigned successfully',
            load,
        });
    } catch (error) {
        next(error);
    }
};
