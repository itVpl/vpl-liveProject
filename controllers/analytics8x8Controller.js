// import axios from 'axios';
// import qs from 'qs'; // npm install qs

// export const getCallRecords = async (req, res) => {
//   try {
//     console.log('🔄 Getting 8x8 call records...');

//     const { from, to } = req.query;

//     // STEP 1: Get Access Token
//     const tokenRes = await axios.post(
//       'https://api.8x8.com/analytics/work/v1/oauth/token',
//       qs.stringify({
//         grant_type: 'password',
//         username: 'EastonMPT',
//         password: 'Easton@18'
//       }),
//       {
//         headers: {
//           'Content-Type': 'application/x-www-form-urlencoded',
//           '8x8-apikey': 'eght_OTI3M2RlYjgtNGE1Zi00MTI1LTk0OTAtMGMwOWNjOTBkY2Mw'
//         }
//       }
//     );

//     const accessToken = tokenRes.data.access_token;
//     console.log('✅ Token received');

//     // STEP 2: Get Call Records (dynamic time)
//     const dataRes = await axios.get(
//       'https://api.8x8.com/analytics/work/v2/call-records',
//       {
//         params: {
//           pbxId: 'allpbxes',
//           startTime: from || '2025-07-02 00:00:00',
//           endTime: to || '2025-07-02 23:59:59',
//           timeZone: 'Asia/Kolkata',
//           pageSize: 1500
//         },
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//           '8x8-apikey': 'eght_OTI3M2RlYjgtNGE1Zi00MTI1LTk0OTAtMGMwOWNjOTBkY2Mw'
//         }
//       }
//     );

//     console.log('✅ Call records fetched');
//     res.status(200).json({
//       success: true,
//       message: 'Call records fetched successfully',
//       data: dataRes.data.data // NOTE: actual records are inside `data.data`
//     });

//   } catch (error) {
//     console.error('❌ Error:', error.response?.data || error.message);
//     res.status(500).json({
//       success: false,
//       message: '8x8 API failed',
//       error: error.response?.data || error.message
//     });
//   }
// };

// export const getFilteredCallRecords = async (req, res) => {
//   try {
//     const { callerName, calleeName, from, to } = req.query;
//     console.log('🔄 Getting filtered 8x8 call records...');

//     // STEP 1: Get Access Token
//     const tokenRes = await axios.post(
//       'https://api.8x8.com/analytics/work/v1/oauth/token',
//       qs.stringify({
//         grant_type: 'password',
//         username: 'EastonMPT',
//         password: 'Easton@18'
//       }),
//       {
//         headers: {
//           'Content-Type': 'application/x-www-form-urlencoded',
//           '8x8-apikey': 'eght_OTI3M2RlYjgtNGE1Zi00MTI1LTk0OTAtMGMwOWNjOTBkY2Mw'
//         }
//       }
//     );
//     const accessToken = tokenRes.data.access_token;
//     console.log('✅ Token received');

//     // STEP 2: Get Call Records with dynamic time range
//     const dataRes = await axios.get(
//       'https://api.8x8.com/analytics/work/v2/call-records',
//       {
//         params: {
//           pbxId: 'allpbxes',
//           startTime: from || '2025-07-02 00:00:00',
//           endTime: to || '2025-07-02 23:59:59',
//           timeZone: 'Asia/Kolkata',
//           pageSize: 1500
//         },
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//           '8x8-apikey': 'eght_OTI3M2RlYjgtNGE1Zi00MTI1LTk0OTAtMGMwOWNjOTBkY2Mw'
//         }
//       }
//     );
//     let records = dataRes.data.data || [];

//     // OR condition for callerName and calleeName
//     if (callerName || calleeName) {
//       const caller = callerName ? callerName.replace(/"/g, '').toLowerCase() : null;
//       const callee = calleeName ? calleeName.replace(/"/g, '').toLowerCase() : null;
//       records = records.filter(r => {
//         const callerMatch = caller ? (r.callerName || '').toLowerCase().includes(caller) : false;
//         const calleeMatch = callee ? (r.calleeName || '').toLowerCase().includes(callee) : false;
//         return callerMatch || calleeMatch;
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: 'Filtered call records fetched successfully',
//       data: records
//     });
//   } catch (error) {
//     console.error('❌ Error:', error.response?.data || error.message);
//     res.status(500).json({
//       success: false,
//       message: '8x8 API failed',
//       error: error.response?.data || error.message
//     });
//   }
// };




import axios from 'axios';
import qs from 'qs';
import { DateTime } from 'luxon'; // for timezone-based date

// 🔹 GET ALL CALL RECORDS (with optional from/to in query)
export const getCallRecords = async (req, res) => {
  try {
    console.log('🔄 Getting 8x8 call records...');

    const { from, to } = req.query;

    // Set current day range in New York timezone if not passed
    const nowNY = DateTime.now().setZone('America/New_York');
    const fromDate = from || nowNY.startOf('day').toFormat('yyyy-MM-dd HH:mm:ss');
    const toDate = to || nowNY.endOf('day').toFormat('yyyy-MM-dd HH:mm:ss');

    // 🔐 Step 1: Get Token
    const tokenRes = await axios.post(
      'https://api.8x8.com/analytics/work/v1/oauth/token',
      qs.stringify({
        grant_type: 'password',
        username: 'EastonMPT',
        password: 'Easton@18'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          '8x8-apikey': 'eght_OTI3M2RlYjgtNGE1Zi00MTI1LTk0OTAtMGMwOWNjOTBkY2Mw'
        }
      }
    );

    const accessToken = tokenRes.data.access_token;
    console.log('✅ Token received');

    // 📞 Step 2: Fetch Call Records
    const dataRes = await axios.get(
      'https://api.8x8.com/analytics/work/v2/call-records',
      {
        params: {
          pbxId: 'allpbxes',
          startTime: fromDate,
          endTime: toDate,
          timeZone: 'America/New_York',
          pageSize: 1500
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          '8x8-apikey': 'eght_OTI3M2RlYjgtNGE1Zi00MTI1LTk0OTAtMGMwOWNjOTBkY2Mw'
        }
      }
    );

    console.log('✅ Call records fetched');
    res.status(200).json({
      success: true,
      message: 'Call records fetched successfully',
      data: dataRes.data.data
    });

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: '8x8 API failed',
      error: error.response?.data || error.message
    });
  }
};

// 🔹 GET FILTERED CALL RECORDS
export const getFilteredCallRecords = async (req, res) => {
  try {
    const { callerName, calleeName, from, to } = req.query;
    console.log('🔄 Getting filtered 8x8 call records...');

    // Set current day range in New York timezone if not passed
    const nowNY = DateTime.now().setZone('America/New_York');
    const fromDate = from || nowNY.startOf('day').toFormat('yyyy-MM-dd HH:mm:ss');
    const toDate = to || nowNY.endOf('day').toFormat('yyyy-MM-dd HH:mm:ss');

    // 🔐 Step 1: Get Token
    const tokenRes = await axios.post(
      'https://api.8x8.com/analytics/work/v1/oauth/token',
      qs.stringify({
        grant_type: 'password',
        username: 'EastonMPT',
        password: 'Easton@18'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          '8x8-apikey': 'eght_OTI3M2RlYjgtNGE1Zi00MTI1LTk0OTAtMGMwOWNjOTBkY2Mw'
        }
      }
    );
    const accessToken = tokenRes.data.access_token;
    console.log('✅ Token received');

    // 📞 Step 2: Fetch Records
    const dataRes = await axios.get(
      'https://api.8x8.com/analytics/work/v2/call-records',
      {
        params: {
          pbxId: 'allpbxes',
          startTime: fromDate,
          endTime: toDate,
          timeZone: 'America/New_York',
          pageSize: 1500
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          '8x8-apikey': 'eght_OTI3M2RlYjgtNGE1Zi00MTI1LTk0OTAtMGMwOWNjOTBkY2Mw'
        }
      }
    );

    let records = dataRes.data.data || [];

    // Optional Filtering by callerName or calleeName
    if (callerName || calleeName) {
      const caller = callerName?.toLowerCase();
      const callee = calleeName?.toLowerCase();
      records = records.filter(r => {
        const callerMatch = caller ? (r.callerName || '').toLowerCase().includes(caller) : false;
        const calleeMatch = callee ? (r.calleeName || '').toLowerCase().includes(callee) : false;
        return callerMatch || calleeMatch;
      });
    }

    res.status(200).json({
      success: true,
      message: 'Filtered call records fetched successfully',
      data: records
    });

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: '8x8 API failed',
      error: error.response?.data || error.message
    });
  }
};
