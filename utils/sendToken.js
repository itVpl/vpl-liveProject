// export const sendToken = (user, statusCode , message , res) => {
//     const token = user.generateToken();
//     console.log("Token generated:", token);

//     // Set cookie expiration in days from env or default to 7
//   const cookieExpireDays = process.env.COOKIE_EXPIRE ? Number(process.env.COOKIE_EXPIRE) : 7;

//     res.status(statusCode).cookie("token", token, {
//         expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
//         httpOnly: true,
        
//     }).json({
//         success: true,
//       message,
//       token,
//       user,
//     });

// };

export const sendToken = (user, statusCode, message, res) => {
  const token = user.generateToken();
  console.log("Token generated:", token);

  const cookieExpireDays = process.env.COOKIE_EXPIRE ? Number(process.env.COOKIE_EXPIRE) : 7;

  res
    .status(statusCode)
    .cookie("token", token, {
      expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
      httpOnly: true,
      sameSite: "None",  // ⬅️ This helps with cookies between ports
      secure: true     // ⬅️ Set to true when deploying on HTTPS
    })
    .json({
      success: true,
      message,
      token,
      user,
    });
};