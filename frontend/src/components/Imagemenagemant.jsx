import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Trash2, 
  Save, 
  X, 
  Star, 
  Image as ImageIcon,
  GripVertical,
  Plus,
  Check,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Eye,
  Loader
} from 'lucide-react';

const ProductImageManager = () => {
  const [images, setImages] = useState([]);
  const [productId] = useState('sample-product-id'); // Replace with actual productId from useParams
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [notification, setNotification] = useState(null);
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);
  const [productData, setProductData] = useState({});
  const [uploadProgress, setUploadProgress] = useState({});
  const apiBaseUrl = 'https://api.toteja.co';

  // โหลดข้อมูลสินค้าและรูปภาพ
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadProductData();
    loadImages();
  }, [productId]);

  const loadProductData = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/images/getProductdata/${productId}`);
      const data = await response.json();
      setProductData(data);
      console.log('Product data loaded:', data);
    } catch (err) {
      console.error('Error fetching product data:', err);
      showNotification('ไม่สามารถโหลดข้อมูลสินค้าได้', 'error');
    }
  };

  const loadImages = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/images/${productId}/images`);
      const data = await response.json();
      if (data.success) {
        setImages(data.images || []);
      }
    } catch (err) {
      console.error('Error fetching images:', err);
      showNotification('ไม่สามารถโหลดรูปภาพได้', 'error');
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // อัปโหลดรูปภาพใหม่ - ใช้ Frontend Upload
  const uploadImageToS3 = async (file) => {
    try {
      // Step 1: ขอ Presigned URL สำหรับอัปโหลดจาก Backend
      const getUrlResponse = await fetch(`${apiBaseUrl}/api/images/getupload-imageData`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filename: file.name,
          filetype: file.type,
          productId: productId
        })
      });

      if (!getUrlResponse.ok) {
        throw new Error('ไม่สามารถขอ Presigned URL ได้');
      }

      const uploadData = await getUrlResponse.json();
      const { uploadUrl, publicUrl } = uploadData;

      // Step 2: อัปโหลดรูปไป S3 โดยตรง
      const uploadToS3Response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type
        },
        body: file
      });

      if (!uploadToS3Response.ok) {
        throw new Error('อัปโหลดรูปไป S3 ไม่สำเร็จ');
      }

      // Step 3: ส่งข้อมูลไป backend เพื่อบันทึก path ลงฐานข้อมูล
      const saveImageResponse = await fetch(`${apiBaseUrl}/api/images/save-image-path`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productId: productId,
          imagePath: publicUrl,
          filename: file.name,
          filesize: file.size,
          displayOrder: images.length + 1
        })
      });

      if (!saveImageResponse.ok) {
        throw new Error('บันทึก path รูปไม่สำเร็จ');
      }

      const savedImageData = await saveImageResponse.json();
      return savedImageData;

    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  // จัดการการเลือกไฟล์
  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files);
    await handleFilesUpload(files);
  };

  // จัดการการอัปโหลดไฟล์
  const handleFilesUpload = async (files) => {
    if (files.length === 0) return;
   
    setIsUploading(true);
    const uploadedImages = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileId = `upload-${Date.now()}-${i}`;
        
        // เพิ่มไฟล์ที่กำลังอัปโหลดเข้าไปใน state เพื่อแสดง progress
        setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));
        
        // สร้าง preview URL
        const previewUrl = URL.createObjectURL(file);
        const tempImage = {
          id: fileId,
          image_path: previewUrl,
          display_order: images.length + uploadedImages.length + 1,
          isMain: false,
          isUploading: true,
          file: file
        };
        
        setImages(prev => [...prev, tempImage]);
        
        try {
          // อัปโหลดไฟล์ผ่าน Frontend
          const result = await uploadImageToS3(file);
          
          // อัปโหลดสำเร็จ - อัปเดตข้อมูลรูปภาพ
          const uploadedImage = {
            id: result.imageId || result.id,
            image_path: result.imagePath || result.image_path,
            display_order: result.displayOrder || result.display_order,
            isMain: result.isMain || false,
            isUploading: false
          };
          
          uploadedImages.push(uploadedImage);
          
          // อัปเดต state
          setImages(prev => prev.map(img => 
            img.id === fileId ? uploadedImage : img
          ));
          
          // ลบ progress
          setUploadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[fileId];
            return newProgress;
          });
          
          // ลบ preview URL
          URL.revokeObjectURL(previewUrl);
          
        } catch (error) {
          console.error('Upload failed for file:', file.name, error);
          // ลบรูปที่อัปโหลดไม่สำเร็จ
          setImages(prev => prev.filter(img => img.id !== fileId));
          setUploadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[fileId];
            return newProgress;
          });
          URL.revokeObjectURL(previewUrl);
          showNotification(`ไม่สามารถอัปโหลด ${file.name} ได้`, 'error');
        }
      }
      
      if (uploadedImages.length > 0) {
        showNotification(`อัปโหลดรูปภาพสำเร็จ ${uploadedImages.length} รูป`, 'success');
        // โหลดข้อมูลใหม่เพื่อซิงค์กับ Backend
        await loadImages();
      }
      
    } catch (error) {
      console.error('Upload process error:', error);
      showNotification('เกิดข้อผิดพลาดในการอัปโหลด', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e, item) => {
    if (item.isUploading) {
      e.preventDefault();
      return;
    }
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, item) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverItem(item);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDrop = (e, dropItem) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.id === dropItem.id || draggedItem.isUploading || dropItem.isUploading) return;

    const draggedIndex = images.findIndex(img => img.id === draggedItem.id);
    const dropIndex = images.findIndex(img => img.id === dropItem.id);
    
    const newImages = [...images];
    const [draggedImage] = newImages.splice(draggedIndex, 1);
    newImages.splice(dropIndex, 0, draggedImage);
    
    // อัปเดต display_order
    const updatedImages = newImages.map((img, index) => ({
      ...img,
      display_order: index + 1
    }));
    
    setImages(updatedImages);
    setDraggedItem(null);
    setDragOverItem(null);
    
    showNotification('ลำดับรูปภาพถูกเปลี่ยนแล้ว');
  };

  const handleMoveUp = (imageId) => {
    const currentIndex = images.findIndex(img => img.id === imageId);
    if (currentIndex === 0) return;
    
    const newImages = [...images];
    [newImages[currentIndex - 1], newImages[currentIndex]] = [newImages[currentIndex], newImages[currentIndex - 1]];
    
    const updatedImages = newImages.map((img, index) => ({
      ...img,
      display_order: index + 1
    }));
    
    setImages(updatedImages);
  };

  const handleMoveDown = (imageId) => {
    const currentIndex = images.findIndex(img => img.id === imageId);
    if (currentIndex === images.length - 1) return;
    
    const newImages = [...images];
    [newImages[currentIndex], newImages[currentIndex + 1]] = [newImages[currentIndex + 1], newImages[currentIndex]];
    
    const updatedImages = newImages.map((img, index) => ({
      ...img,
      display_order: index + 1
    }));
    
    setImages(updatedImages);
  };

  const handleSetMain = async (imageId) => {
    const currentMainImage = images.find(img => img.isMain);
    console.log("Old main:", currentMainImage);
    
    // Optimistic update
    const updatedImages = images.map(img => ({
      ...img,
      isMain: img.id === imageId
    }));
    setImages(updatedImages); 
    showNotification('กำลังเปลี่ยนรูปภาพหลัก...');
    
    try {
      // ใช้ Backend API สำหรับเปลี่ยนรูปหลัก
      const response = await fetch(`${apiBaseUrl}/api/images/${productId}/set-main`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: imageId, isMain: true }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to set main image.');
      }

      // โหลดข้อมูลใหม่เพื่อซิงค์กับ Backend
      await loadImages();
      showNotification('รูปภาพหลักถูกเปลี่ยนสำเร็จแล้ว!', 'success');
    } catch (error) {
      console.error('Error setting main image:', error);
      showNotification(`ไม่สามารถเปลี่ยนรูปภาพหลักได้: ${error.message}`, 'error');
      // Revert on error
      await loadImages();
    }
  };

  // ลบรูปภาพ
  const handleDelete = async (imageId) => {
    try {
      const imageToDelete = images.find(img => img.id === imageId);
      
      // ถ้าเป็นรูปที่กำลังอัปโหลดให้ลบได้เลย
      if (imageToDelete?.isUploading) {
        setImages(images.filter(img => img.id !== imageId));
        return;
      }

      // ใช้ Backend API สำหรับลบรูปภาพ
      const response = await fetch(
        `${apiBaseUrl}/api/images/delete/${productData.category}/${productData.subcategory}/${productId}/${imageId}`,
        { method: 'DELETE' }
      );

      const result = await response.json();
      if (result.success) {
        // โหลดข้อมูลใหม่เพื่อซิงค์กับ Backend
        await loadImages();
        showNotification('รูปภาพถูกลบแล้ว', 'success');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Delete error:', error);
      showNotification('ไม่สามารถลบรูปภาพได้', 'error');
    }
  };

  // บันทึกลำดับรูปภาพ
  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // เตรียมข้อมูลลำดับรูปภาพ (ไม่รวมรูปที่กำลังอัปโหลด)
      const imageOrders = images
        .filter(img => !img.isUploading)
        .map(img => ({
          imageId: img.id,
          displayOrder: img.display_order
        }));

      console.log('Saving image orders:', imageOrders);

      // ใช้ Backend API สำหรับบันทึกลำดับรูปภาพ
      const response = await fetch(`${apiBaseUrl}/api/images/reorder/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageOrders }),
      });

      const result = await response.json();
      if (result.success) {
        showNotification('บันทึกลำดับรูปภาพสำเร็จ!', 'success');
        // โหลดข้อมูลใหม่เพื่อซิงค์กับ Backend
        await loadImages();
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      console.error('Save error:', error);
      showNotification('เกิดข้อผิดพลาดในการบันทึก', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // File drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFileDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      await handleFilesUpload(imageFiles);
    }
  };

  // สร้าง image URL - ใช้ Backend API สำหรับดูรูปภาพ
  const getImageUrl = (imagePath) => {
    if (imagePath.startsWith('blob:') || imagePath.startsWith('data:') || imagePath.startsWith('https')){
      return imagePath;
    }
    // ใช้ Backend API สำหรับดูรูปภาพ
    return `${apiBaseUrl}/api/images/view/${encodeURIComponent(imagePath)}`;
  };

  return (
    <div className="mt-15 min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-700/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              จัดการรูปภาพสินค้า
            </h1>
            <p className="text-gray-400 mt-1">{productData.name}</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 rounded-xl transition-all duration-200 shadow-lg hover:shadow-blue-500/25 disabled:cursor-not-allowed"
            >
              {isUploading ? <Loader size={18} className="animate-spin" /> : <Plus size={18} />}
              {isUploading ? 'กำลังอัปโหลด...' : 'เพิ่มรูปภาพ'}
            </button>
            
            <button
              onClick={handleSave}
              disabled={isSaving || isUploading}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 rounded-xl transition-all duration-200 shadow-lg hover:shadow-green-500/25 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {isSaving ? 'กำลังบันทึก...' : 'บันทึกลำดับ'}
            </button>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg backdrop-blur-sm transition-all duration-300 ${
          notification.type === 'success' 
            ? 'bg-green-600/90 text-white' 
            : 'bg-red-600/90 text-white'
        }`}>
          {notification.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          {notification.message}
        </div>
      )}

      <div className="p-6">
        {/* Drop Zone */}
        <div
          ref={dropZoneRef}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleFileDrop}
          className="border-2 border-dashed border-gray-600 hover:border-blue-500 rounded-2xl p-8 mb-6 transition-all duration-200 bg-gray-900/30 backdrop-blur-sm"
        >
          <div className="text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-300 mb-2">ลากและวางไฟล์รูปภาพที่นี่</p>
            <p className="text-gray-500 text-sm">หรือ</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="mt-2 px-6 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 rounded-xl transition-colors disabled:cursor-not-allowed"
            >
              {isUploading ? 'กำลังอัปโหลด...' : 'เลือกไฟล์'}
            </button>
          </div>
        </div>

        {/* Images Grid */}
        {images.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {images.map((image, index) => (
              <div
                key={image.id}
                draggable={!image.isUploading}
                onDragStart={(e) => handleDragStart(e, image)}
                onDragOver={(e) => handleDragOver(e, image)}
                onDrop={(e) => handleDrop(e, image)}
                onDragEnd={handleDragEnd}
                className={`relative group bg-gray-900/50 backdrop-blur-sm rounded-2xl overflow-hidden border-2 transition-all duration-300 ${
                  image.isUploading ? 'cursor-not-allowed' : 'cursor-move'
                } hover:shadow-2xl hover:shadow-blue-500/20 ${
                  dragOverItem?.id === image.id ? 'border-blue-500 scale-105' : 'border-gray-700'
                } ${
                  image.isMain ? 'ring-2 ring-yellow-500/50' : ''
                }`}
              >
                {/* Loading Overlay */}
                {image.isUploading && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex items-center justify-center">
                    <div className="text-center">
                      <Loader className="animate-spin mx-auto mb-2" size={24} />
                      <p className="text-sm text-white">กำลังอัปโหลด...</p>
                    </div>
                  </div>
                )}

                {/* Main Image Badge */}
                {image.isMain && (
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs font-semibold rounded-full shadow-lg">
                    <Star size={12} />
                    หลัก
                  </div>
                )}

                {/* Order Number */}
                <div className="absolute bottom-3 left-3 z-10 w-8 h-8 bg-gray-900/80 backdrop-blur-sm rounded-full flex items-center justify-center text-white font-bold text-sm border border-gray-600">
                  {image.display_order}
                </div>

                {/* Image */}
                <div className="aspect-square relative overflow-hidden">
                  <img
                    src={getImageUrl(image.image_path)}
                    alt={`Product image ${image.display_order}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                {/* Controls */}
                {!image.isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="flex items-center gap-2 bg-gray-900/90 backdrop-blur-sm rounded-xl p-2 shadow-lg border border-gray-700">
                      {/* Move Up */}
                      <button
                        onClick={() => handleMoveUp(image.id)}
                        disabled={index === 0}
                        className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
                        title="เลื่อนขึ้น"
                      >
                        <ArrowUp size={16} />
                      </button>

                      {/* Move Down */}
                      <button
                        onClick={() => handleMoveDown(image.id)}
                        disabled={index === images.length - 1}
                        className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
                        title="เลื่อนลง"
                      >
                        <ArrowDown size={16} />
                      </button>

                      {/* Set as Main */}
                      {!image.isMain && (
                        <button
                          onClick={() => handleSetMain(image.id)}
                          className="p-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors"
                          title="ตั้งเป็นรูปหลัก"
                        >
                          <Star size={16} />
                        </button>
                      )}

                      {/* Preview */}
                      <button
                        onClick={() => setPreviewImage(image)}
                        className="p-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                        title="ดูตัวอย่าง"
                      >
                        <Eye size={16} />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(image.id)}
                        className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                        title="ลบรูปภาพ"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Drag Handle */}
                {!image.isUploading && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                    <GripVertical size={24} className="text-white drop-shadow-lg" />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <ImageIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-300 mb-2">ยังไม่มีรูปภาพ</h3>
            <p className="text-gray-500 mb-4">เริ่มเพิ่มรูปภาพสินค้าของคุณ</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 rounded-xl transition-all disabled:cursor-not-allowed"
            >
              {isUploading ? 'กำลังอัปโหลด...' : 'เพิ่มรูปภาพแรก'}
            </button>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-gray-900/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-200">คำแนะนำการใช้งาน</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-400">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>ลากและวางรูปภาพเพื่ออัปโหลดและจัดเรียงลำดับ</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>ใช้ปุ่ม **"เพิ่มรูปภาพ"** เพื่อเลือกไฟล์จากคอมพิวเตอร์ของคุณ</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>คลิกที่ไอคอนลูกศรขึ้น/ลง เพื่อ **เลื่อนลำดับ** รูปภาพ</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>คลิกที่ไอคอนรูปดาวเพื่อ **ตั้งเป็นรูปหลัก**</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>คลิกที่ไอคอนรูปถังขยะเพื่อ **ลบ** รูปภาพ</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>อย่าลืมกดปุ่ม **"บันทึกลำดับ"** เพื่อบันทึกการเปลี่ยนแปลงทั้งหมด</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>คุณสามารถดูตัวอย่างรูปภาพได้โดยคลิกที่ไอคอนรูปตา</span>
            </div>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl max-h-full overflow-hidden rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 p-2 bg-gray-800/70 hover:bg-gray-700/80 rounded-full text-white z-10 transition-colors"
            >
              <X size={24} />
            </button>
            <img 
              src={getImageUrl(previewImage.image_path)} 
              alt="Preview" 
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        multiple
        accept="image/*"
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default ProductImageManager;