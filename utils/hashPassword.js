import bcrypt from 'bcrypt';

const hashPassword = async (plainPassword) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(plainPassword, salt);
};

export default hashPassword; // ✅ ESM default export
