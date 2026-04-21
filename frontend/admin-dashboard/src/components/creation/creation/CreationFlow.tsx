// @ts-nocheck
import React, { useState, useMemo, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { StorageService } from "../../../services/storageService";
import { useCreation } from "../../../context/CreationContext";

import Header from "./common/Header";
import Footer from "./common/Footer";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { api } from "../../../utils/api";
import axios from "axios";
import {
  HiOutlineExclamationCircle,
  HiOutlineX,
  HiOutlineChevronRight,
  HiOutlineInformationCircle,
} from "react-icons/hi";

// Import Screens
import Step1Intro from "./step1/index";
import Step1PlaceType from "./step1/placeType";
import Step1PlaceType2 from "./step1/placeType2";
import Step1Location1 from "./step1/location1";
import Step1Basics from "./step1/basics";
import Step1BathroomTypes from "./step1/bathroomTypes";
import Step1End from "./step1/stepEnd";

import Step2 from "./step2/index";
import Step2Amenities from "./step2/placeOffer";
import Step2Photos from "./step2/photost";
import Step2Title from "./step2/title";
import Step2Describe from "./step2/describe";
import Step2Description from "./step2/description";

import Step3Intro from "./step3/Intro";
import Step3WeekdayPrice from "./step3/weekdayPrice";
import Step3WeekendPrice from "./step3/weekendPrice";
import Step3SafetyDetails from "./step3/safetyDetails";
import Step4AirbnbUrls from "./step4/airbnbUrls";

const AMENITY_MAP = {
  Wifi: { key: "favorites", value: "wifi" },
  TV: { key: "favorites", value: "tv" },
  Kitchen: { key: "favorites", value: "kitchen" },
  Washer: { key: "favorites", value: "washer" },
  "Free parking on premises": { key: "favorites", value: "free_parking" },
  "Paid parking on premises": { key: "favorites", value: "paid_parking" },
  "Air conditioning": { key: "favorites", value: "air_conditioning" },
  "Dedicated workspace": { key: "favorites", value: "dedicated_workspace" },
  Pool: { key: "amenities", value: "pool" },
  "Hot tub": { key: "amenities", value: "hot_tub" },
  Patio: { key: "amenities", value: "patio" },
  "BBQ grill": { key: "amenities", value: "bbq_grill" },
  "Outdoor dining area": { key: "amenities", value: "outdoor_dining" },
  "Fire pit": { key: "amenities", value: "fire_pit" },
  "Pool table": { key: "amenities", value: "pool_table" },
  "Indoor fireplace": { key: "amenities", value: "indoor_fireplace" },
  Piano: { key: "amenities", value: "piano" },
  "Exercise equipment": { key: "amenities", value: "exercise" },
  "Lake access": { key: "amenities", value: "lake_access" },
  "Beach access": { key: "amenities", value: "beach_access" },
  "Ski-in/Ski-out": { key: "amenities", value: "ski_in_out" },
  "Outdoor shower": { key: "amenities", value: "outdoor_shower" },
  "Smoke alarm": { key: "safetyItems", value: "smoke_alarm" },
  "First aid kit": { key: "safetyItems", value: "first_aid" },
  "Fire extinguisher": { key: "safetyItems", value: "fire_extinguisher" },
  "Carbon monoxide alarm": {
    key: "safetyItems",
    value: "carbon_monoxide_alarm",
  },
};

const CreationFlow = ({ mode = "listing", onClose, unitDraft = null }) => {
  const {
    listingId,
    setListingId,
    activeIndex,
    setActiveIndex,
    isSubmitting,
    setIsSubmitting,
    updateListingProgress,
    resetCreation,
  } = useCreation();

  const isAdminUnitFlow = mode === "admin-unit";
  const containerHeightClass = isAdminUnitFlow ? "h-full" : "h-screen";
  const containerWidthClass = isAdminUnitFlow ? "max-w-5xl" : "max-w-8xl";
  const contentPaddingClass = isAdminUnitFlow ? "px-4 py-4 sm:px-6" : "px-6 sm:px-12";
  const screenPaddingClass = isAdminUnitFlow ? "py-4 sm:py-5" : "py-6";
  const isEditUnitPopup = isAdminUnitFlow && !!unitDraft?.id;

  const MIN_UNIT_PHOTOS = 5;

  const screens = [
    "step1-intro",
    "step1-place-type",
    "step1-location1",
    "step1-basics",
    "step1-bathroom-types",
    "step1-end",
    "step2-intro",
    "step2-amenities",
    "step2-photos",
    "step2-title",
    "step2-describe",
    "step2-description",
    "step3-intro",
    "step3-weekday-price",
    "step3-weekend-price",
    "step3-safety-details",
    "step4-airbnb-urls",
  ];

  const [isFlowLoading, setIsFlowLoading] = useState(true);
  const [isCurrentStepValid, setIsCurrentStepValid] = useState(true);
  const [currentStepData, setCurrentStepData] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showBackConfirmModal, setShowBackConfirmModal] = useState(false);
  const [errorMessages, setErrorMessages] = useState([]);
  const [errorFields, setErrorFields] = useState([]);
  const [errorQueue, setErrorQueue] = useState([]);
  const [isErrorMode, setIsErrorMode] = useState(false);
  const [showNavWarningModal, setShowNavWarningModal] = useState(false);

  const FIELD_TO_SCREEN_MAP = {
    category: 1,
    placeType: 1,
    country: 3,
    streetAddress: 3,
    city: 3,
    state: 3,
    postalCode: 3,
    guests: 4,
    bedrooms: 4,
    beds: 4,
    privateBathroom: 5,
    dedicatedBathroom: 5,
    sharedBathroom: 5,
    whoElse: 6,
    amenities: 8,
    favorites: 8,
    safetyItems: 8,
    photos: 9,
    title: 10,
    highlights: 11,
    description: 12,
    weekdayPrice: 14,
    weekendPrice: 15,
    safetyDetails: 16,
    airbnbListingUrl: 17,
    airbnbIcalUrl: 17,
  };

  const mainRef = useRef(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editListingId = searchParams.get("edit");

  // Load persisted step or edit mode
  useEffect(() => {
    const loadStep = async () => {
      if (isAdminUnitFlow) {
        try {
          if (unitDraft) {
            await resetCreation();
            const initialLocationFullAddress = [
              unitDraft.street_address,
              unitDraft.floor,
              unitDraft.city,
              unitDraft.state,
              unitDraft.postal_code,
              unitDraft.country,
            ]
              .filter(Boolean)
              .join(", ");
            await StorageService.setItem("step 1 host", {
              placeType: unitDraft.category || "",
              guestPlaceType: unitDraft.place_type
                ? { id: unitDraft.place_type }
                : { id: "" },
              location: {
                fullAddress: initialLocationFullAddress,
                country: unitDraft.country || "",
                street: unitDraft.street_address || "",
                apt: unitDraft.floor || "",
                city: unitDraft.city || "",
                state: unitDraft.state || "",
                zipCode: unitDraft.postal_code || "",
                manualEntry: true,
                preciseLocation: !!unitDraft.home_precise,
              },
              basics: {
                guests: unitDraft.max_guests ?? 1,
                bedrooms: Number(unitDraft.bedrooms ?? unitDraft.bedroom_count ?? 0),
                beds: Number(unitDraft.beds ?? unitDraft.bed_count ?? 0),
                hasLock: !!unitDraft.bedroom_lock,
              },
              bathrooms: {
                private: Number(unitDraft.private_bathroom || 0),
                dedicated: Number(unitDraft.dedicated_bathroom || 0),
                shared: Number(unitDraft.shared_bathroom || 0),
              },
              whoElse: unitDraft.who_else_present || ["Me"],
            });

            await StorageService.setItem("step 2 host", {
              amenities: unitDraft.amenities || [],
              favorites: unitDraft.favorites || [],
              safetyItems: unitDraft.safety_items || [],
            });

            await StorageService.setItem("step 2 title", {
              title: unitDraft.name || "",
            });

            if (unitDraft.description) {
              await StorageService.setItem("step 2 description", {
                description: unitDraft.description,
              });
            }

            await StorageService.setItem("step 2 description highlights", {
              highlights: unitDraft.highlights || [],
            });

            if (unitDraft.image_urls && unitDraft.image_urls.length > 0) {
              const photos = unitDraft.image_urls.map((url, idx) => ({
                publicId: url,
                secureUrl: url,
                isUploaded: true,
                name: `unit-${unitDraft.id || idx}`,
              }));
              await StorageService.setItem("step 2 photos", { photos });
              await StorageService.setItem("step2", { photos });
            }

            await StorageService.setItem("step 3 weekday price", {
              price: unitDraft.weekday_price ?? unitDraft.nightly_rate_usd ?? 0,
              guestPrice: unitDraft.weekday_after_tax_price ?? 0,
            });

            await StorageService.setItem("step 3 safety details", {
              selectedItems: unitDraft.safety_details || [],
            });

            await StorageService.setItem("step 4 airbnb urls", {
              listingUrl: unitDraft.airbnb_listing_url || "",
              icalUrl: unitDraft.airbnb_ical_url || "",
            });
            setActiveIndex(0);
          } else {
            await resetCreation();
            setActiveIndex(0);
          }
        } catch (err) {
          console.error("Failed to load unit flow:", err);
        } finally {
          setIsFlowLoading(false);
        }
        return;
      }

      try {
        if (editListingId) {
          const pending = await StorageService.getPendingListing(editListingId);
          if (pending && pending.data) {
            setListingId(editListingId);
            setActiveIndex(0);
            navigate(location.pathname, { replace: true });
            setIsFlowLoading(false);
            return;
          }

          if (editListingId === "local-draft-id") {
            const savedIndex = await StorageService.getItem(
              "creation_flow_step",
            );
            if (savedIndex !== null) setActiveIndex(Number(savedIndex));
            navigate(location.pathname, { replace: true });
            setIsFlowLoading(false);
            return;
          }

          const response = await api.get(`/listings/${editListingId}`);
          const listingData = response.data?.data;
          if (listingData) {
            setListingId(editListingId);
            await StorageService.setItem("creation_listing_id", editListingId);
          }

          setActiveIndex(0);
          navigate(location.pathname, { replace: true });
          return;
        }

        if (searchParams.get("new") === "true") {
          await resetCreation();
          navigate(location.pathname, { replace: true });
          return;
        }

        const savedIndex = await StorageService.getItem("creation_flow_step");
        if (savedIndex !== null) setActiveIndex(Number(savedIndex));

        const savedListingId = await StorageService.getItem(
          "creation_listing_id",
        );
        if (savedListingId) setListingId(savedListingId);
      } catch (err) {
        console.error("Failed to load flow:", err);
      } finally {
        setIsFlowLoading(false);
      }
    };
    loadStep();
  }, []); // Only run once on mount

  // Persist index
  useEffect(() => {
    if (!isFlowLoading)
      StorageService.setItem("creation_flow_step", activeIndex);
  }, [activeIndex, isFlowLoading]);

  const renderScreen = () => {
    const props = {
      onValidityChange: setIsCurrentStepValid,
      onDataChange: setCurrentStepData,
    };
    switch (screens[activeIndex]) {
      case "step1-intro":
        return <Step1Intro {...props} />;
      case "step1-place-type":
        return <Step1PlaceType {...props} />;
      case "step1-place-type2":
        return <Step1PlaceType2 {...props} />;
      case "step1-location1":
        return <Step1Location1 {...props} />;
      case "step1-basics":
        return <Step1Basics {...props} />;
      case "step1-bathroom-types":
        return <Step1BathroomTypes {...props} />;
      case "step1-end":
        return <Step1End {...props} />;
      case "step2-intro":
        return <Step2 {...props} />;
      case "step2-amenities":
        return <Step2Amenities {...props} />;
      case "step2-photos":
        return <Step2Photos {...props} />;
      case "step2-title":
        return <Step2Title {...props} />;
      case "step2-describe":
        return <Step2Describe {...props} />;
      case "step2-description":
        return <Step2Description {...props} />;
      case "step3-intro":
        return <Step3Intro {...props} />;
      case "step3-weekday-price":
        return <Step3WeekdayPrice {...props} />;
      case "step3-weekend-price":
        return <Step3WeekendPrice {...props} />;
      case "step3-safety-details":
        return <Step3SafetyDetails {...props} />;
      case "step4-airbnb-urls":
        return <Step4AirbnbUrls {...props} />;
      default:
        return null;
    }
  };


  const buildUnitPayload = async () => {
    const step1 = (await StorageService.getItem("step 1 host")) || {};
    const step2Amenities = (await StorageService.getItem("step 2 host")) || {};
    const step2Photos = (await StorageService.getItem("step 2 photos")) || {};
    const step2Title = (await StorageService.getItem("step 2 title")) || {};
    const step2Highlights =
      (await StorageService.getItem("step 2 description highlights")) || {};
    const step2Description = (await StorageService.getItem("step 2 description")) || {};
    const step3WeekdayPrice = (await StorageService.getItem("step 3 weekday price")) || {};
    const step3WeekendPrice = (await StorageService.getItem("step 3 weekend price")) || {};
    const step3Safety = (await StorageService.getItem("step 3 safety details")) || {};
    const step4Urls = (await StorageService.getItem("step 4 airbnb urls")) || {};

    const draftPhotos = step2Photos.photos || [];
    const uploadedFallbackPhotos = (await StorageService.getItem("step2"))?.photos || [];
    const uploadedPhotoObjects = draftPhotos.some((p) => p.publicId && p.secureUrl)
      ? draftPhotos
      : uploadedFallbackPhotos;

    const photos = uploadedPhotoObjects
      .filter((p) => p.publicId && p.secureUrl)
      .map((p) => p.secureUrl);

    return {
      name: step2Title.title || "Untitled unit",
      description: step2Description.description || undefined,
      nightly_rate_usd: Number(step3WeekdayPrice.price || 0),
      max_guests: Number(step1.basics?.guests || 1),
      bedrooms: Number(step1.basics?.bedrooms || 0) || undefined,
      beds: Number(step1.basics?.beds || 0) || undefined,
      airbnb_listing_url: step4Urls.listingUrl || undefined,
      airbnb_ical_url: step4Urls.icalUrl || "",
      image_urls: photos.length >= MIN_UNIT_PHOTOS ? photos : undefined,
      category: step1.placeType || undefined,
      place_type: step1.guestPlaceType?.id || undefined,
      country: step1.location?.country || undefined,
      street_address: step1.location?.street || undefined,
      floor: step1.location?.apt || undefined,
      city: step1.location?.city || undefined,
      state: step1.location?.state || undefined,
      postal_code: step1.location?.zip || step1.location?.zipCode || undefined,
      home_precise: !!step1.location?.preciseLocation,
      bedroom_lock: !!step1.basics?.hasLock,
      private_bathroom: Number(step1.bathrooms?.private || 0),
      dedicated_bathroom: Number(step1.bathrooms?.dedicated || 0),
      shared_bathroom: Number(step1.bathrooms?.shared || 0),
      bathroom_usage: (() => {
        const usage = [];
        if (step1.bathrooms?.private > 0) usage.push("Private and attached bathroom");
        if (step1.bathrooms?.dedicated > 0) usage.push("Dedicated bathroom");
        if (step1.bathrooms?.shared > 0) usage.push("Shared bathroom");
        return usage;
      })(),
      who_else_present: step1.whoElse || [],
      favorites: step2Amenities.favorites || undefined,
      amenities: step2Amenities.amenities || undefined,
      safety_items: step2Amenities.safetyItems || undefined,
      highlights: step2Highlights.highlights || undefined,
      safety_details: step3Safety.selectedItems || undefined,
      weekday_price: Number(step3WeekdayPrice.price || 0),
      weekend_price: Number(step3WeekendPrice.basePrice || 0)
    };
  };

  const syncDataToBackend = async (payloadOverride = null, shouldSyncToBackend = false) => {
    if (isAdminUnitFlow) return true;
    return true;
  };

  const handleNext = async () => {
    if (currentStepData) {
      const keys = Object.keys(currentStepData);
      for (const key of keys) {
        const newData = currentStepData[key];
        const existing = (await StorageService.getItem(key)) || {};
        await StorageService.setItem(
          key,
          typeof newData === "object" && !Array.isArray(newData)
            ? { ...existing, ...newData }
            : newData,
        );
      }
    }

    const currentScreen = screens[activeIndex];

    if (currentScreen === "step2-photos") {
      const photosData = currentStepData?.["step 2 photos"]?.photos || [];
      if (photosData.length < MIN_UNIT_PHOTOS) {
        toast.error("Please add at least " + MIN_UNIT_PHOTOS + " photos.");
        return;
      }

      setIsSubmitting(true);
      const finalPhotos = [];
      const uploadToastId = "photo-upload-progress";

      try {
        let i = 0;
        for (const p of photosData) {
          if (!p.isUploaded && p.file) {
            i++;
            toast.loading(`Uploading photo ${i} of ${photosData.length}...`, {
              id: uploadToastId,
            });

            const formData = new FormData();
            formData.append("photos", p.file);

            const res = await api.post("/admin/units/photos/upload", formData);

            if (res.data?.data?.[0]) {
              finalPhotos.push({
                publicId: res.data.data[0].publicId,
                secureUrl: res.data.data[0].secureUrl,
              });
            }
          } else if (p.publicId && p.secureUrl) {
            finalPhotos.push({
              publicId: p.publicId,
              secureUrl: p.secureUrl,
            });
          }
        }

        if (finalPhotos.length < MIN_UNIT_PHOTOS) {
          toast.error("Please add at least " + MIN_UNIT_PHOTOS + " valid photos.", { id: uploadToastId });
          setIsSubmitting(false);
          return;
        }

        const existingStep2 = (await StorageService.getItem("step2")) || {};
        await StorageService.setItem("step2", {
          ...existingStep2,
          photos: finalPhotos,
        });
        await StorageService.setItem("step 2 photos", {
          photos: finalPhotos.map((photo) => ({
            ...photo,
            url: photo.secureUrl,
            isUploaded: true,
            name: photo.publicId,
          })),
        });

        toast.success("Photos saved locally!", { id: uploadToastId });
      } catch (err) {
        console.error("Photo upload failed:", err);
        toast.error("Upload failed. Please try again.", { id: uploadToastId });
        setIsSubmitting(false);
        return;
      } finally {
        setIsSubmitting(false);
      }
    }

    if (activeIndex <= screens.length - 1) {
      if (currentScreen === "step4-airbnb-urls") {
        console.log("Attempting to publish from last screen...");
        setIsSubmitting(true);
        try {
          const payload = await buildUnitPayload();
          if (unitDraft?.id) {
            await api.put(`/admin/units/${unitDraft.id}`, payload);
            toast.success("Unit updated!");
          } else {
            await api.post(`/admin/units`, payload);
            toast.success("Unit created!");
          }
          await resetCreation();
          navigate("/units");
          onClose?.(true);
          return;
        } catch (err) {
          console.error("Unit creation error:", err);
          const backendMsg = err?.response?.data?.error || err?.response?.data?.message || err.message;
          setErrorMessages(
            Array.isArray(backendMsg)
              ? backendMsg
              : typeof backendMsg === "string"
                ? backendMsg.split(", ")
                : [backendMsg],
          );
          toast.error(typeof backendMsg === "string" ? backendMsg : (unitDraft?.id ? "Failed to update unit" : "Failed to create unit"));
        } finally {
          setIsSubmitting(false);
        }
        return;
      }

      const next = activeIndex + 1;
      setActiveIndex(next);
      await StorageService.setItem("creation_flow_step", next);

      setIsCurrentStepValid(true);
      setCurrentStepData(null);
    }
  };

  const handleBack = async () => {
    if (isErrorMode) {
      setShowNavWarningModal(true);
      return;
    }
    if (activeIndex > 0) {
      const prev = activeIndex - 1;
      setActiveIndex(prev);
      await StorageService.setItem("creation_flow_step", prev);
      setIsCurrentStepValid(true);
    }
  };

  const handleSaveAndExit = async (shouldNavigate = true) => {
    /* 
    if (isErrorMode) {
      setShowNavWarningModal(true);
      return;
    }
    setIsSubmitting(true);
    try {
      await StorageService.setItem("creation_flow_step", activeIndex);

      if (currentStepData) {
        const keys = Object.keys(currentStepData);
        for (const key of keys) {
          const newData = currentStepData[key];
          const existing = (await StorageService.getItem(key)) || {};
          await StorageService.setItem(
            key,
            typeof newData === "object" && !Array.isArray(newData)
              ? { ...existing, ...newData }
              : newData,
          );
        }
      }

      if (isAdminUnitFlow) {
        if (shouldNavigate) {
          toast.success("Progress saved!");
          onClose?.();
        }
        return;
      }

      const shouldSync = !isAdminUnitFlow && !!(
        listingId || (await StorageService.getItem("creation_listing_id"))
      );
      await syncDataToBackend({ lastStepIndex: activeIndex }, shouldSync);

      if (shouldNavigate) {
        toast.success("Progress saved!");
        navigate("/units");
      }
    } catch (err) {
      console.error("Save & Exit Error:", err);
      if (shouldNavigate) {
        toast.success("Progress saved!");
        onClose?.();
      }
    } finally {
      setIsSubmitting(false);
    }
    */
    onClose?.();
  };

  if (isFlowLoading)
    return (
      <div className={`${containerHeightClass} flex items-center justify-center`}>
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <div className={`${containerHeightClass} w-full ${containerWidthClass} mx-auto flex flex-col bg-white overflow-hidden`}>
      <Header onSaveAndExit={handleSaveAndExit} compact={isAdminUnitFlow} exitOnly={isEditUnitPopup} />
      <main
        ref={mainRef}
        className={`flex-1 overflow-y-auto no-scrollbar flex flex-col ${contentPaddingClass}`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4 }}
            className={`w-full h-full flex flex-col items-center ${screenPaddingClass}`}
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer
        currentStep={activeIndex < 7 ? 1 : activeIndex < 13 ? 2 : activeIndex < 17 ? 3 : 4}
        onNext={handleNext}
        onBack={handleBack}
        isFirst={activeIndex === 0}
        isLast={activeIndex === screens.length - 1}
        nextDisabled={!isCurrentStepValid || isSubmitting}
        backDisabled={isSubmitting}
        compact={isAdminUnitFlow}
      />

      {createPortal(
        <AnimatePresence>
          {showErrorModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => {
                setIsErrorMode(false);
                setShowErrorModal(false);
              }}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <HiOutlineExclamationCircle className="text-4xl text-red-500" />
                </div>
                <h3 className="text-xl font-bold mb-4 text-center text-secondary">
                  Action Required
                </h3>
                <div className="bg-red-50 p-4 rounded-2xl border border-red-100 max-h-48 overflow-y-auto no-scrollbar mb-6">
                  {errorMessages.map((m, i) => (
                    <p
                      key={i}
                      className="text-[13px] text-red-600 font-medium mb-2 last:mb-0 leading-relaxed"
                    >
                      - {m}
                    </p>
                  ))}
                </div>

                <div className="space-y-3">
                  {/* Initially only one page redirection button (the first one) */}
                  {errorQueue.length > 0 && (
                    <button
                      onClick={() => {
                        const [nextIdx, ...remaining] = errorQueue;
                        setErrorQueue(remaining);
                        setActiveIndex(nextIdx);
                        setIsErrorMode(true);
                        setShowErrorModal(false);
                      }}
                      className="w-full py-4 bg-gray-50 hover:bg-gray-100 text-[#222222] font-semibold rounded-2xl border border-gray-200 transition-colors flex items-center justify-between px-6"
                    >
                      <span className="text-left pr-4">
                        Fix{" "}
                        {screens[errorQueue[0]]
                          .split("-")
                          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                          .join(" ")}
                      </span>
                      <HiOutlineChevronRight className="w-5 h-5 flex-shrink-0" />
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setIsErrorMode(false);
                      setShowErrorModal(false);
                      navigate("/units");
                      onClose?.();
                    }}
                    className="w-full py-4 bg-white text-secondary font-bold rounded-2xl border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    Skip and Exit to Units
                  </button>

                  <button
                    onClick={() => {
                      setIsErrorMode(false);
                      setShowErrorModal(false);
                    }}
                    className="w-full py-4 bg-black text-white font-bold rounded-2xl shadow-lg hover:bg-zinc-800 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {showNavWarningModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setShowNavWarningModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-[32px] p-10 max-w-md w-full shadow-2xl relative text-center"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <HiOutlineInformationCircle className="text-4xl text-blue-500" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-secondary">
                  Campos pendientes
                </h3>
                <p className="text-[#717171] leading-relaxed mb-8">
                  Resta informacion obligatoria para publicar la unidad. Seguí con <strong>Siguiente</strong> para completar los pasos faltantes.
                </p>
                <button
                  onClick={() => setShowNavWarningModal(false)}
                  className="w-full py-4 bg-black text-white font-bold rounded-2xl shadow-lg hover:bg-zinc-800 transition-all active:scale-95"
                >
                  Entendido
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
};

export default CreationFlow;
























































































