import React from "react";
import { Link } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";

interface LogoProps {
  // Size variant options
  size?: "sm" | "md" | "lg";
  // Whether to include emojis
  showEmojis?: boolean;
  // Whether to make it a link to home
  asLink?: boolean;
  // Optional additional className
  className?: string;
}

export function Logo({ 
  size = "md", 
  showEmojis = true, 
  asLink = true,
  className = ""
}: LogoProps) {
  const isMobile = useIsMobile();
  
  // Size-specific classes
  const sizeClasses = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-3xl"
  };
  
  // Emoji container size classes (for spacing)
  const emojiContainerClasses = {
    sm: "ml-1",
    md: "ml-2",
    lg: "ml-3"
  };
  
  // Duck emoji size classes (slightly larger)
  const duckSizeClasses = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-3xl"
  };
  
  // Egg emoji size classes (slightly smaller than duck)
  const eggSizeClasses = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-2xl"
  };
  
  const LogoContent = (
    <div className={`font-bold flex items-center ${sizeClasses[size]} ${className}`}>
      <span className="text-gray-500 dark:text-gray-400">5</span>
      <span className="text-gray-700 dark:text-gray-300">Ducks</span>
      
      {showEmojis && (
        <div className={`flex items-end ${emojiContainerClasses[size]}`}>
          <span className={duckSizeClasses[size]}>🐥</span>
          {/* Hide eggs on mobile */}
          <span className={`${eggSizeClasses[size]} hidden md:inline`}>🥚🥚🥚🥚</span>
        </div>
      )}
    </div>
  );
  
  // If logo should be a link, wrap in Link component
  if (asLink) {
    return (
      <Link href="/" className="group hover:opacity-90 transition-opacity">
        {LogoContent}
      </Link>
    );
  }
  
  // Otherwise just return the logo content
  return LogoContent;
}