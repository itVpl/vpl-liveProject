import axios from 'axios';
import qs from 'qs'; // npm install qs

export const getCallRecords = async (req, res) => {
  try {
    console.log('🔄 Getting 8x8 call records...');

    // STEP 1: Get Access Token
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

    // const tokenRes = await axios.post(
    //   'https://api.8x8.com/analytics/work/v1/oauth/token',
    //   qs.stringify({
    //     grant_type: 'client_credentials',
    //     client_id: 'eght_OTI3M2RlYjgtNGE1Zi00MTI1LTk0OTAtMGMwOWNjOTBkY2Mw',
    //     client_secret: 'Zjk4OTUxMzAtZWNlOC00OTY2LTliZjQtMDM3NTcxM2FkNjFj'
    //   }),
    //   {
    //     headers: {
    //       'Content-Type': 'application/x-www-form-urlencoded'
    //     }
    //   }
    // );


    // const tokenRes = await axios.post(
    //   'https://api.8x8.com/analytics/work/v1/oauth/token',
    //   qs.stringify({
    //     grant_type: 'client_credentials',
    //     client_id: 'eght_OTI3M2RlYjgtNGE1Zi00MTI1LTk0OTAtMGMwOWNjOTBkY2Mw',
    //     client_secret: 'Zjk4OTUxMzAtZWNlOC00OTY2LTliZjQtMDM3NTcxM2FkNjFj'
    //   }),
    //   {
    //     headers: {
    //       'Content-Type': 'application/x-www-form-urlencoded'
    //     }
    //   }
    // );

    const accessToken = tokenRes.data.access_token;
    console.log('✅ Token received');

    // STEP 2: Get Call Records
    const dataRes = await axios.get(
      'https://api.8x8.com/analytics/work/v2/call-records',
      {
        params: {
          pbxId: 'allpbxes',
          startTime: '2025-06-19 00:00:00',
          endTime: '2025-06-19 23:59:59',
          timeZone: 'Asia/Kolkata',
          pageSize: 50
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
      data: dataRes.data.data // NOTE: actual records are inside `data.data`
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
