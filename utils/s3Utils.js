import AWS from 'aws-sdk';

// AWS S3 Configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

/**
 * Delete a file from S3
 * @param {string} key - The S3 object key
 * @returns {Promise<boolean>} - Success status
 */
export const deleteFileFromS3 = async (key) => {
  try {
    if (!key) return false;
    
    // Extract key from URL if full URL is provided
    const bucketName = process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME;
    let objectKey = key;
    
    if (key.startsWith(`https://${bucketName}.s3.`)) {
      objectKey = key.replace(`https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/`, '');
    }
    
    const params = {
      Bucket: bucketName,
      Key: objectKey
    };
    
    await s3.deleteObject(params).promise();
    console.log(`✅ File deleted from S3: ${objectKey}`);
    return true;
  } catch (error) {
    console.error(`❌ Error deleting file from S3: ${error.message}`);
    return false;
  }
};

/**
 * Delete multiple files from S3
 * @param {string[]} keys - Array of S3 object keys
 * @returns {Promise<boolean>} - Success status
 */
export const deleteMultipleFilesFromS3 = async (keys) => {
  try {
    if (!keys || keys.length === 0) return true;
    
    const bucketName = process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME;
    const objects = keys.map(key => {
      let objectKey = key;
      if (key.startsWith(`https://${bucketName}.s3.`)) {
        objectKey = key.replace(`https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/`, '');
      }
      return { Key: objectKey };
    });
    
    const params = {
      Bucket: bucketName,
      Delete: {
        Objects: objects,
        Quiet: false
      }
    };
    
    const result = await s3.deleteObjects(params).promise();
    console.log(`✅ Deleted ${result.Deleted.length} files from S3`);
    
    if (result.Errors && result.Errors.length > 0) {
      console.error('❌ Some files failed to delete:', result.Errors);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error deleting multiple files from S3: ${error.message}`);
    return false;
  }
};

/**
 * Generate a presigned URL for file upload
 * @param {string} key - The S3 object key
 * @param {string} contentType - The content type of the file
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600)
 * @returns {Promise<string>} - Presigned URL
 */
export const generatePresignedUploadUrl = async (key, contentType, expiresIn = 3600) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      Expires: expiresIn
    };
    
    const url = await s3.getSignedUrlPromise('putObject', params);
    return url;
  } catch (error) {
    console.error(`❌ Error generating presigned URL: ${error.message}`);
    throw error;
  }
};

/**
 * Generate a presigned URL for file download
 * @param {string} key - The S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600)
 * @returns {Promise<string>} - Presigned URL
 */
export const generatePresignedDownloadUrl = async (key, expiresIn = 3600) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME,
      Key: key,
      Expires: expiresIn
    };
    
    const url = await s3.getSignedUrlPromise('getObject', params);
    return url;
  } catch (error) {
    console.error(`❌ Error generating presigned download URL: ${error.message}`);
    throw error;
  }
};

/**
 * Get S3 URL from object key
 * @param {string} key - The S3 object key
 * @returns {string} - Full S3 URL
 */
export const getS3Url = (key) => {
  if (!key) return '';
  const bucketName = process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME;
  const region = process.env.AWS_REGION || 'us-east-1';
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
};

/**
 * Extract object key from S3 URL
 * @param {string} url - The S3 URL
 * @returns {string} - Object key
 */
export const getObjectKeyFromUrl = (url) => {
  if (!url) return '';
  const bucketName = process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME;
  const region = process.env.AWS_REGION || 'us-east-1';
  const prefix = `https://${bucketName}.s3.${region}.amazonaws.com/`;
  
  if (url.startsWith(prefix)) {
    return url.replace(prefix, '');
  }
  return url;
};

/**
 * Check if file exists in S3
 * @param {string} key - The S3 object key
 * @returns {Promise<boolean>} - Whether file exists
 */
export const fileExistsInS3 = async (key) => {
  try {
    if (!key) return false;
    
    let objectKey = key;
    const bucketName = process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME;
    
    if (key.startsWith(`https://${bucketName}.s3.`)) {
      objectKey = getObjectKeyFromUrl(key);
    }
    
    const params = {
      Bucket: bucketName,
      Key: objectKey
    };
    
    await s3.headObject(params).promise();
    return true;
  } catch (error) {
    if (error.code === 'NotFound') {
      return false;
    }
    console.error(`❌ Error checking file existence in S3: ${error.message}`);
    return false;
  }
};

/**
 * Get file metadata from S3
 * @param {string} key - The S3 object key
 * @returns {Promise<Object>} - File metadata
 */
export const getFileMetadata = async (key) => {
  try {
    if (!key) return null;
    
    let objectKey = key;
    const bucketName = process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME;
    
    if (key.startsWith(`https://${bucketName}.s3.`)) {
      objectKey = getObjectKeyFromUrl(key);
    }
    
    const params = {
      Bucket: bucketName,
      Key: objectKey
    };
    
    const result = await s3.headObject(params).promise();
    return {
      size: result.ContentLength,
      contentType: result.ContentType,
      lastModified: result.LastModified,
      etag: result.ETag
    };
  } catch (error) {
    console.error(`❌ Error getting file metadata from S3: ${error.message}`);
    return null;
  }
};

export default {
  deleteFileFromS3,
  deleteMultipleFilesFromS3,
  generatePresignedUploadUrl,
  generatePresignedDownloadUrl,
  getS3Url,
  getObjectKeyFromUrl,
  fileExistsInS3,
  getFileMetadata
}; 