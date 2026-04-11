import { HeroSection } from "../components/sections/home/HeroSection";
import { StorytellingSection } from "../components/sections/home/StorytellingSection";
import { FeaturedLoftsSection } from "../components/sections/home/FeaturedLoftsSection";
import { PhilosophySection } from "../components/sections/home/PhilosophySection";
import { LocationSection } from "../components/sections/home/LocationSection";
import { ContactCTASection } from "../components/sections/home/ContactCTASection";

// Kept for backward compatibility with UnitCard and PaymentResultPage, which
// both import this type from here. All runtime data now lives in the
// FeaturedLoftsSection, which fetches units and maps them to this shape.
export interface ListingCardData {
  id: string;
  title: string;
  images: string[];
  pricePerNight: number;
  subtitle?: string;
  meta?: string;
  currencySymbol?: string;
  originalPricePerNight?: number;
  cancellationText?: string;
}

export default function UnitListingPage() {
  return (
    <div className="relative">
      <HeroSection />
      <StorytellingSection />
      <FeaturedLoftsSection />
      <PhilosophySection />
      <LocationSection />
      <ContactCTASection />
    </div>
  );
}
