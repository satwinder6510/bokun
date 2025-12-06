import { Link } from "wouter";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { 
  Palmtree, Building2, Users, Mountain, Gem, Wallet, 
  Landmark, Binoculars, Ship, Waves, TriangleRight, Map,
  Flower2, Church, PawPrint, Umbrella
} from "lucide-react";

interface CollectionCategory {
  tag: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
}

const COLLECTION_CATEGORIES: CollectionCategory[] = [
  {
    tag: "Beach",
    title: "Beach Holidays",
    description: "Sun, sand and sea - perfect beach getaways",
    icon: <Palmtree className="h-10 w-10" />,
    gradient: "from-cyan-500 to-blue-600"
  },
  {
    tag: "City Break",
    title: "City Breaks",
    description: "Explore vibrant cities and urban adventures",
    icon: <Building2 className="h-10 w-10" />,
    gradient: "from-slate-600 to-slate-800"
  },
  {
    tag: "Family",
    title: "Family Holidays",
    description: "Create lasting memories with the whole family",
    icon: <Users className="h-10 w-10" />,
    gradient: "from-amber-500 to-orange-600"
  },
  {
    tag: "Adventure",
    title: "Adventure Tours",
    description: "Thrilling experiences for the adventurous spirit",
    icon: <Mountain className="h-10 w-10" />,
    gradient: "from-emerald-500 to-green-700"
  },
  {
    tag: "Luxury",
    title: "Luxury Escapes",
    description: "Premium experiences and five-star service",
    icon: <Gem className="h-10 w-10" />,
    gradient: "from-purple-500 to-purple-800"
  },
  {
    tag: "Budget",
    title: "Value Holidays",
    description: "Amazing holidays that won't break the bank",
    icon: <Wallet className="h-10 w-10" />,
    gradient: "from-green-500 to-teal-600"
  },
  {
    tag: "Cultural",
    title: "Cultural Journeys",
    description: "Immerse yourself in rich history and traditions",
    icon: <Landmark className="h-10 w-10" />,
    gradient: "from-rose-500 to-red-700"
  },
  {
    tag: "Safari",
    title: "Safari Adventures",
    description: "Witness incredible wildlife in their natural habitat",
    icon: <Binoculars className="h-10 w-10" />,
    gradient: "from-yellow-600 to-amber-700"
  },
  {
    tag: "Cruise",
    title: "Ocean Cruises",
    description: "Set sail on unforgettable ocean voyages",
    icon: <Ship className="h-10 w-10" />,
    gradient: "from-blue-500 to-indigo-700"
  },
  {
    tag: "River Cruise",
    title: "River Cruises",
    description: "Scenic journeys along the world's great rivers",
    icon: <Waves className="h-10 w-10" />,
    gradient: "from-sky-500 to-blue-600"
  },
  {
    tag: "Golden Triangle",
    title: "Golden Triangle Tours",
    description: "India's iconic Delhi, Agra and Jaipur circuit",
    icon: <TriangleRight className="h-10 w-10" />,
    gradient: "from-orange-500 to-amber-600"
  },
  {
    tag: "Multi-Centre",
    title: "Multi-Centre Holidays",
    description: "Visit multiple destinations in one amazing trip",
    icon: <Map className="h-10 w-10" />,
    gradient: "from-violet-500 to-purple-700"
  },
  {
    tag: "Wellness",
    title: "Wellness Retreats",
    description: "Rejuvenate mind, body and soul",
    icon: <Flower2 className="h-10 w-10" />,
    gradient: "from-pink-400 to-rose-600"
  },
  {
    tag: "Religious",
    title: "Pilgrimage Tours",
    description: "Spiritual journeys to sacred destinations",
    icon: <Church className="h-10 w-10" />,
    gradient: "from-slate-500 to-slate-700"
  },
  {
    tag: "Wildlife",
    title: "Wildlife Experiences",
    description: "Get close to nature's most amazing creatures",
    icon: <PawPrint className="h-10 w-10" />,
    gradient: "from-lime-500 to-green-600"
  },
  {
    tag: "Island",
    title: "Island Escapes",
    description: "Discover paradise on stunning island getaways",
    icon: <Umbrella className="h-10 w-10" />,
    gradient: "from-teal-400 to-cyan-600"
  }
];

export default function Collections() {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <Header />
      
      <main className="flex-1">
        <div className="bg-slate-800 text-white py-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-collections-title">
              Holiday Collections
            </h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Browse our curated collections of flight packages and land tours, grouped by holiday type
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {COLLECTION_CATEGORIES.map((collection) => (
              <Link 
                key={collection.tag}
                href={`/holidays/${encodeURIComponent(collection.tag.toLowerCase().replace(/\s+/g, '-'))}`}
              >
                <div 
                  className={`relative overflow-hidden rounded-lg bg-gradient-to-br ${collection.gradient} p-6 h-48 flex flex-col justify-between cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-xl`}
                  data-testid={`card-collection-${collection.tag.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="text-white/90">
                    {collection.icon}
                  </div>
                  <div className="text-white">
                    <h2 className="text-xl font-bold mb-1">{collection.title}</h2>
                    <p className="text-sm text-white/80">{collection.description}</p>
                  </div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
