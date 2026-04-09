// @ts-nocheck
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { StorageService } from "../../../../services/storageService";
import { HiOutlineX, HiOutlinePhotograph } from "react-icons/hi";
import toast from "react-hot-toast";

const MIN_PHOTOS = 5;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg"];

const normalizePhotos = (photoList = []) =>
  photoList.map((photo, idx) => {
    const fallbackUrl = photo.url || photo.secureUrl || "";
    const fallbackId =
      photo.id || photo.publicId || `${photo.name || "photo"}-${idx}`;

    return {
      ...photo,
      id: String(fallbackId),
      url: fallbackUrl,
      secureUrl: photo.secureUrl || fallbackUrl,
      name: photo.name || photo.publicId || `photo-${idx + 1}`,
    };
  });

const PhotoUpload = ({ onValidityChange, onDataChange }) => {
  const [photos, setPhotos] = useState([]);
  const [category, setCategory] = useState("place");

  useEffect(() => {
    const loadData = async () => {
      try {
        const step1Data = await StorageService.getItem("step 1 host");
        if (step1Data && step1Data.placeType) {
          setCategory(step1Data.placeType.toLowerCase());
        }

        const savedStep2 = await StorageService.getItem("step2");
        if (savedStep2 && savedStep2.photos) {
          setPhotos(
            normalizePhotos(
              savedStep2.photos.map((p, idx) => ({
                id: p.publicId || `uploaded-${idx}`,
                url: p.secureUrl,
                publicId: p.publicId,
                secureUrl: p.secureUrl,
                isUploaded: true,
                name: p.publicId,
              })),
            ),
          );
        } else {
          const draftData = await StorageService.getItem("step 2 photos");
          if (draftData && draftData.photos) {
            setPhotos(normalizePhotos(draftData.photos));
          }
        }
      } catch (err) {
        console.error("Failed to load photo data:", err);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const isValid = photos.length >= MIN_PHOTOS;
    onValidityChange?.(isValid);
    onDataChange?.({ "step 2 photos": { photos } });
  }, [photos]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const validNewPhotos = [];
    const errors = [];

    files.forEach((file) => {
      const isDuplicate = photos.some(
        (p) => p.name === file.name && p.size === file.size,
      );
      if (isDuplicate) {
        errors.push(`${file.name} is already added.`);
        return;
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name} is not a valid format (PNG, JPG, or JPEG).`);
        return;
      }


      validNewPhotos.push({
        id: Math.random().toString(36).substring(2, 11),
        url: URL.createObjectURL(file),
        name: file.name,
        size: file.size,
        file,
        isUploaded: false,
      });
    });

    if (errors.length > 0) {
      toast.error(errors[0], {
        style: { borderRadius: "10px", background: "#333", color: "#fff" },
      });
    }

    if (validNewPhotos.length > 0) {
      setPhotos((prev) => [...prev, ...validNewPhotos]);
    }

    e.target.value = "";
  };

  const removePhoto = (id) => {
    setPhotos((prev) => {
      const photoToRemove = prev.find((p) => p.id === id);
      if (photoToRemove?.url?.startsWith("blob:")) {
        URL.revokeObjectURL(photoToRemove.url);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const setAsCover = (id) => {
    setPhotos((prev) => {
      const index = prev.findIndex((p) => p.id === id);
      if (index <= 0) return prev;
      const newPhotos = [...prev];
      const [movedPhoto] = newPhotos.splice(index, 1);
      newPhotos.unshift(movedPhoto);
      return newPhotos;
    });
  };

  const renderPhotoCard = (
    photo,
    idx,
    imageClass = "h-24 w-full object-cover",
    showSetAsCover = true,
  ) => (
    <div
      key={photo.id || `photo-${idx}`}
      className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50 group"
    >
      <img
        src={
          photo.url?.includes("cloudinary.com")
            ? photo.url.replace("/upload/", "/upload/q_auto,f_auto,w_500/")
            : photo.url
        }
        alt={`Photo ${idx + 1}`}
        loading="lazy"
        className={imageClass}
      />
      <button
        onClick={() => removePhoto(photo.id)}
        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#222222] shadow-sm"
      >
        <HiOutlineX className="text-sm" />
      </button>
      {showSetAsCover && (
        <button
          onClick={() => setAsCover(photo.id)}
          className="absolute bottom-2 left-2 right-2 rounded-lg bg-white/90 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-secondary shadow-sm opacity-0 transition-all group-hover:opacity-100"
        >
          Set as cover
        </button>
      )}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-5xl overflow-y-auto  md:px-4 no-scrollbar">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col"
      >
        <div className="mb-6">
          <h1 className="mb-1 text-2xl font-semibold text-secondary md:text-3xl">
            Add some photos of your {category}
          </h1>
          <p className="text-[10px] text-[#6A6A6A] md:text-[12px]">
            You'll need at least {MIN_PHOTOS} photos to get started. You can add
            more or make changes later.
            <span
              className={`ml-2 font-semibold ${photos.length >= MIN_PHOTOS ? "text-green-600" : "text-[#1e3a8a]"}`}
            >
              ({photos.length} uploaded, minimum {MIN_PHOTOS})
            </span>
          </p>
        </div>

        {photos.length === 0 ? (
          <div
            className="flex min-h-[300px] w-full flex-1 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#B0B0B0] bg-[#FCF8F5] transition-all duration-300 hover:border-primary group"
            onClick={() => document.getElementById("photo-upload").click()}
          >
            <input
              type="file"
              id="photo-upload"
              className="hidden"
              multiple
              accept="image/png, image/jpeg, image/jpg"
              onChange={handleFileChange}
            />

            <div className="flex max-w-sm flex-col items-center p-8 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-transform duration-500 group-hover:scale-110">
                <img
                  src="https://res.cloudinary.com/di9tb45rl/image/upload/v1769772458/Vector_wzfhc9.png"
                  alt="Upload"
                  loading="lazy"
                  className="h-10 w-10 object-contain"
                />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold tracking-tight text-secondary md:text-2xl">
                  Upload your photos
                </h3>
                <p className="text-sm font-medium text-[#717171] md:text-base">
                  Drag and drop your photos here or
                </p>

                <div className="pt-4">
                  <span className="inline-flex items-center justify-center rounded-xl bg-[#1e3a8a] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-[#1e3a8a]/20 transition-all hover:bg-[#172d69] active:scale-95">
                    Choose photos
                  </span>
                </div>

                <p className="pt-6 text-[10px] font-semibold uppercase tracking-widest text-[#9c9c9c] md:text-xs">
                  PNG, JPG or JPEG
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4">
            <div className="grid min-h-[400px] grid-cols-1 grid-rows-2 gap-3 md:grid-cols-4">
              <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 md:col-span-2 md:row-span-2 group">
                {photos[0] ? (
                  <>
                    <img
                      src={
                        photos[0].url?.includes("cloudinary.com")
                          ? photos[0].url.replace(
                            "/upload/",
                            "/upload/q_auto,f_auto,w_800/",
                          )
                          : photos[0].url
                      }
                      alt="Main room"
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <button
                      onClick={() => removePhoto(photos[0].id)}
                      className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-md transition-all hover:bg-white active:scale-95"
                    >
                      <HiOutlineX className="text-lg text-secondary" />
                    </button>
                    <div className="absolute bottom-3 right-3 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                      Cover photo
                    </div>
                  </>
                ) : (
                  <EmptySlot
                    index={0}
                    onClick={() =>
                      document.getElementById("photo-upload").click()
                    }
                  />
                )}
              </div>

              {[1, 2, 3, 4].map((idx) => (
                <div
                  key={idx}
                  className="relative overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 group"
                >
                  {photos[idx] ? (
                    <>
                      <img
                        src={
                          photos[idx].url?.includes("cloudinary.com")
                            ? photos[idx].url.replace(
                              "/upload/",
                              "/upload/q_auto,f_auto,w_400/",
                            )
                            : photos[idx].url
                        }
                        alt={`View ${idx}`}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      <button
                        onClick={() => removePhoto(photos[idx].id)}
                        className="absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm transition-all hover:bg-white active:scale-95"
                      >
                        <HiOutlineX className="text-base text-secondary" />
                      </button>
                      <button
                        onClick={() => setAsCover(photos[idx].id)}
                        className="absolute bottom-2 left-2 right-2 rounded-lg bg-white/90 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-secondary shadow-sm opacity-0 transition-all group-hover:opacity-100"
                      >
                        Set as cover
                      </button>
                    </>
                  ) : (
                    <EmptySlot
                      index={idx}
                      onClick={() =>
                        document.getElementById("photo-upload").click()
                      }
                    />
                  )}
                </div>
              ))}
            </div>

            {photos.length > 5 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6A6A6A]">
                  More photos
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {photos
                    .slice(5)
                    .map((photo, extraIdx) =>
                      renderPhotoCard(
                        photo,
                        extraIdx + 5,
                        "h-28 w-full object-cover",
                        true,
                      ),
                    )}
                </div>
              </div>
            )}

            <div className="mt-2 flex justify-center">
              <button
                onClick={() => document.getElementById("photo-upload").click()}
                className="flex items-center gap-2 rounded-xl border-2 border-[#1e3a8a] px-6 py-2 text-sm font-semibold text-[#1e3a8a] transition-all hover:bg-[#1e3a8a]/5"
              >
                <HiOutlinePhotograph />
                Add more photos
              </button>
              <input
                type="file"
                id="photo-upload"
                className="hidden"
                multiple
                accept="image/png, image/jpeg, image/jpg"
                onChange={handleFileChange}
              />
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const EmptySlot = ({ index, onClick }) => (
  <div
    onClick={onClick}
    className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 transition-all hover:bg-gray-100/80"
  >
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
      <HiOutlinePhotograph className="text-xl text-gray-300" />
    </div>
    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
      Add Photo {index + 1}
    </span>
  </div>
);

export default PhotoUpload;


