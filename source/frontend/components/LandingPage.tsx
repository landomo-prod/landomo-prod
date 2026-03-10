"use client";

import Image from "next/image";
import { Search, ArrowRight, Home, Tag, Key, LayoutDashboard, Instagram, Facebook, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PropertyCard } from "@/components/PropertyCard";
import { usePropertyLikes } from "@/hooks/usePropertyLikes";
import { useSearchContext } from "@/contexts/SearchContext";
import { PortalNavigation } from "@/components/PortalNavigation";

interface LandingPageProps {
  onNavigateToExplorer: () => void;
}

export function LandingPage({ onNavigateToExplorer }: LandingPageProps) {
  const { toggleLike, isLiked } = usePropertyLikes();
  const { results, isLoading } = useSearchContext();

  return (
    <div className="flex flex-col bg-white">
      {/* Top Sticky Nav */}
      <PortalNavigation
        onMapExplorerClick={onNavigateToExplorer}
      />

      {/* Hero Section - Full-bleed emotional hero */}
      <section className="relative w-full flex items-end justify-start overflow-hidden h-screen">
        <Image
          src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1920&q=80"
          alt="Prague real estate"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>

        <div className="relative z-10 px-12 pb-24 max-w-3xl w-full">
          <p className="text-white/70 text-sm font-bold uppercase tracking-widest mb-4">Prague, Czech Republic</p>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-4 tracking-tight leading-[0.95]">
            Find your place<br />in Prague.
          </h1>
          <p className="text-white/60 text-lg font-medium mb-10 max-w-lg">
            Explore thousands of verified listings across the city's most desirable neighborhoods.
          </p>

          {/* Search Bar */}
          <div className="bg-white p-2 rounded-full shadow-2xl flex items-center max-w-xl ring-8 ring-white/10">
            <Input
              type="text"
              placeholder="Search by district, street, or neighborhood"
              className="flex-1 bg-transparent px-8 py-4 outline-none text-lg font-bold border-0 focus-visible:ring-0"
            />
            <Button
              onClick={onNavigateToExplorer}
              className="text-white p-4 rounded-full transition-all shadow-lg" style={{ backgroundColor: '#84CC16' }}
              size="icon"
            >
              <Search className="w-6 h-6" />
            </Button>
          </div>

          <div className="mt-6 flex gap-3">
            <Button variant="ghost" className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-white/20 transition-all">
              Buy
            </Button>
            <Button variant="ghost" className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-white/20 transition-all">
              Rent
            </Button>
            <Button variant="ghost" className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-white/20 transition-all">
              New developments
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Listings Section */}
      <section className="py-24 px-12 bg-white">
        <div className="max-w-[1800px] mx-auto">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl font-black tracking-tight">Newest Listings in Prague</h2>
              <p className="text-gray-500 font-medium mt-2">Discover recently added properties from verified owners.</p>
            </div>
            <button
              className="text-[#84CC16] font-bold flex items-center gap-2 hover:underline"
              onClick={onNavigateToExplorer}
            >
              View all <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {isLoading && results.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-gray-200 rounded-2xl h-48 mb-3" />
                  <div className="bg-gray-200 rounded h-5 w-32 mb-2" />
                  <div className="bg-gray-200 rounded h-4 w-48" />
                </div>
              ))
            ) : (
              results.slice(0, 4).map((property) => (
                <div key={property.id} onClick={onNavigateToExplorer}>
                  <PropertyCard
                    property={property}
                    isLiked={isLiked(property.id)}
                    onToggleLike={toggleLike}
                    onNavigate={onNavigateToExplorer}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Service Blocks */}
      <section className="py-24 px-12 bg-gray-50">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
          <div className="bg-white p-12 rounded-3xl shadow-sm hover:shadow-xl transition-all group">
            <div className="w-16 h-16 bg-lime-50 text-[#84CC16] rounded-full flex items-center justify-center mx-auto mb-8 group-hover:bg-[#84CC16] group-hover:text-[#171717] transition-colors">
              <Home className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black mb-4">Buy a home</h3>
            <p className="text-gray-500 text-sm leading-relaxed mb-8">
              Find your place with an immersive photo experience and the most listings, including things you won&apos;t find anywhere else.
            </p>
            <Button variant="outline" className="border-[#84CC16] text-[#84CC16] px-8 py-3 rounded-full text-sm font-bold hover:bg-[#84CC16] hover:text-[#171717] transition-all">
              Browse homes
            </Button>
          </div>
          <div className="bg-white p-12 rounded-3xl shadow-sm hover:shadow-xl transition-all group">
            <div className="w-16 h-16 bg-lime-50 text-[#84CC16] rounded-full flex items-center justify-center mx-auto mb-8 group-hover:bg-[#84CC16] group-hover:text-[#171717] transition-colors">
              <Tag className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black mb-4">Sell a home</h3>
            <p className="text-gray-500 text-sm leading-relaxed mb-8">
              No matter what path you take to sell your home, we can help you navigate a successful sale at the best market value.
            </p>
            <Button variant="outline" className="border-[#84CC16] text-[#84CC16] px-8 py-3 rounded-full text-sm font-bold hover:bg-[#84CC16] hover:text-[#171717] transition-all">
              See options
            </Button>
          </div>
          <div className="bg-white p-12 rounded-3xl shadow-sm hover:shadow-xl transition-all group">
            <div className="w-16 h-16 bg-lime-50 text-[#84CC16] rounded-full flex items-center justify-center mx-auto mb-8 group-hover:bg-[#84CC16] group-hover:text-[#171717] transition-colors">
              <Key className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black mb-4">Rent a home</h3>
            <p className="text-gray-500 text-sm leading-relaxed mb-8">
              We&apos;re creating a seamless online experience – from shopping on the largest rental network, to applying, to paying rent.
            </p>
            <Button variant="outline" className="border-[#84CC16] text-[#84CC16] px-8 py-3 rounded-full text-sm font-bold hover:bg-[#84CC16] hover:text-[#171717] transition-all">
              Find rentals
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-12 px-12 border-t border-gray-100">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#84CC16] rounded flex items-center justify-center text-white">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <span className="text-xl font-black tracking-tight">Landomo</span>
          </div>
          <p className="text-gray-400 text-xs font-bold">© 2026 Landomo Real Estate. All rights reserved.</p>
          <div className="flex gap-6 text-gray-400">
            <Instagram className="w-5 h-5 cursor-pointer hover:text-gray-900 transition-colors" />
            <Facebook className="w-5 h-5 cursor-pointer hover:text-gray-900 transition-colors" />
            <Twitter className="w-5 h-5 cursor-pointer hover:text-gray-900 transition-colors" />
          </div>
        </div>
      </footer>
    </div>
  );
}
