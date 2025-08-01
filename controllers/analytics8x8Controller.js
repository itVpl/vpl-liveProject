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
import { DateTime } from 'luxon';

// 🔥 NEW: Helper function to get talktime for specific user
export const getUserTalkTime = async (userAlias, targetDate) => {
  try {
    console.log(`🔄 Getting talktime for user: ${userAlias} on date: ${targetDate}`);

    // Set time range for the target date
    const startTime = DateTime.fromISO(targetDate).startOf('day').toFormat('yyyy-MM-dd HH:mm:ss');
    const endTime = DateTime.fromISO(targetDate).endOf('day').toFormat('yyyy-MM-dd HH:mm:ss');

    // 🔐 Step 1: Get Token
    const tokenRes = await axios.post(
      'https://api.8x8.com/analytics/work/v1/oauth/token',
      qs.stringify({
        grant_type: 'password',
        username: 'EastonMPT',
        password: 'VPLeaston@18'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          '8x8-apikey': 'eght_OTI3M2RlYjgtNGE1Zi00MTI1LTk0OTAtMGMwOWNjOTBkY2Mw'
        }
      }
    );

    const accessToken = tokenRes.data.access_token;
    console.log('✅ 8x8 Token received');

    // 📞 Step 2: Fetch Call Records
    const dataRes = await axios.get(
      'https://api.8x8.com/analytics/work/v2/call-records',
      {
        params: {
          pbxId: 'allpbxes',
          startTime: startTime,
          endTime: endTime,
          timeZone: 'America/New_York',
          pageSize: 1500
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          '8x8-apikey': 'eght_OTI3M2RlYjgtNGE1Zi00MTI1LTk0OTAtMGMwOWNjOTBkY2Mw'
        }
      }
    );

    const allRecords = dataRes.data.data || [];
    console.log(`✅ Total call records fetched: ${allRecords.length}`);

    // Filter records for specific user alias
    const userRecords = allRecords.filter(record => {
      const callerName = (record.callerName || '').toLowerCase();
      const calleeName = (record.calleeName || '').toLowerCase();
      const userAliasLower = userAlias.toLowerCase();
      
      return callerName.includes(userAliasLower) || calleeName.includes(userAliasLower);
    });

    console.log(`✅ Filtered records for ${userAlias}: ${userRecords.length}`);

    // Calculate call statistics
    let totalCalls = 0;
    let totalTalkTime = 0;
    let totalDuration = 0;

    userRecords.forEach(record => {
      // Check if call was answered and has talk time
      if (record.answered === 'Answered' && record.talkTimeMS && record.talkTimeMS > 0) {
        totalCalls++;
        
        // Calculate talk time in minutes (talkTimeMS is in milliseconds)
        const durationMinutes = Math.round(record.talkTimeMS / (1000 * 60));
        totalTalkTime += durationMinutes;
        totalDuration += record.talkTimeMS;
      }
    });

    return {
      totalCalls,
      totalTalkTime: Math.round(totalTalkTime), // in minutes
      totalDuration, // in milliseconds
      callRecords: userRecords
    };

  } catch (error) {
    console.error('❌ Error fetching talktime from 8x8:', error.message);
    return {
      totalCalls: 0,
      totalTalkTime: 0,
      totalDuration: 0,
      callRecords: [],
      error: error.message
    };
  }
}; // for timezone-based date

// 🔹 GET ALL CALL RECORDS (with optional from/to in query)
export const getCallRecords = async (req, res) => {
  try {
    console.log('🔄 Getting 8x8 call records...');

    const { from, to, pageSize } = req.query;

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
        password: 'VPLeaston@18'
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
          pageSize: pageSize || 1500
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
    const { callerName, calleeName, from, to, pageSize } = req.query;
    console.log('🔄 Getting filtered 8x8 call records...');
    console.log('🔍 Query parameters:', { callerName, calleeName, from, to, pageSize });

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
        password: 'VPLeaston@18'
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
          pageSize: pageSize || 1500
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          '8x8-apikey': 'eght_OTI3M2RlYjgtNGE1Zi00MTI1LTk0OTAtMGMwOWNjOTBkY2Mw'
        }
      }
    );

    let records = dataRes.data.data || [];
    console.log(`✅ Total records fetched: ${records.length}`);

    // Optional Filtering by callerName or calleeName
    if (callerName || calleeName) {
      const caller = callerName?.toLowerCase();
      const callee = calleeName?.toLowerCase();
      console.log('🔍 Filtering by:', { caller, callee });
      
      records = records.filter(r => {
        const callerMatch = caller ? (r.callerName || '').toLowerCase().includes(caller) : false;
        const calleeMatch = callee ? (r.calleeName || '').toLowerCase().includes(callee) : false;
        return callerMatch || calleeMatch;
      });
      
      console.log(`✅ Filtered records: ${records.length}`);
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
