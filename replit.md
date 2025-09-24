# Overview

This is a German e-commerce marketplace application built as a full-stack web application. The platform serves as a dropshipping marketplace that integrates with CJ Dropshipping for product sourcing and order fulfillment. The application features a modern, responsive design with comprehensive shopping cart functionality, wishlist management, and payment processing capabilities.

The application targets German-speaking markets and includes features like multi-currency support, product search and filtering, category-based navigation, and a complete checkout flow with Stripe payment integration.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Technology Stack**: Vanilla JavaScript, HTML5, CSS3 with Bootstrap 5.3.0
- **Design Pattern**: Component-based architecture with modular CSS and JavaScript files
- **Responsive Design**: Mobile-first approach with Bootstrap grid system and custom media queries
- **State Management**: LocalStorage for cart and wishlist persistence
- **Navigation**: Single-page application feel with hash-based routing for categories

## Backend Architecture
- **Framework**: Node.js with Express.js
- **API Structure**: RESTful endpoints for payment processing, email notifications, and CJ Dropshipping integration
- **Middleware**: Compression middleware for performance, CORS handling for cross-origin requests
- **File Structure**: Modular separation with dedicated files for different API integrations

## E-commerce Features
- **Shopping Cart**: Persistent cart with localStorage, quantity management, and real-time updates
- **Product Management**: JSON-based product catalog with image optimization and lazy loading
- **Search & Filter**: Client-side search with category filtering and sorting options
- **Wishlist**: Persistent wishlist functionality with add/remove capabilities
- **Multi-language Support**: German primary language with internationalization considerations

## Performance Optimizations
- **Image Optimization**: Lazy loading with Intersection Observer API
- **Resource Loading**: DNS prefetching, preloading critical resources, deferred script loading
- **Caching Strategy**: Browser caching for static assets with cache-busting for updates
- **Compression**: Gzip compression for all text-based resources

# External Dependencies

## Payment Processing
- **Stripe**: Complete payment integration with webhook support for order confirmation
- **Configuration**: Environment variable-based setup with fallback handling

## Email Services
- **SendGrid**: Transactional email service for order confirmations and customer communications
- **EmailJS**: Client-side email functionality for contact forms and customer support

## Dropshipping Integration
- **CJ Dropshipping API**: Complete integration with 31 authentic API endpoints across 8 categories
- **Fallback System**: Mock data system for development and testing when API is unavailable
- **Authentication**: Token-based authentication with automatic refresh capabilities

## External APIs & Services
- **Bootstrap CDN**: UI framework and icons
- **Google Fonts**: Typography (Inter font family)
- **Cookie Consent**: CookieYes integration for GDPR compliance

## Development Tools
- **Nodemon**: Development server with auto-restart
- **Vite**: Build tool and development server (configured but not actively used)
- **Environment Management**: dotenv for configuration management

## Product Management
- **Image Storage**: Local file system with organized directory structure
- **Product Data**: JSON-based catalog with support for real-time price updates
- **Category Management**: Hierarchical category system with dedicated styling per category

## Third-party Integrations
- **Currency Conversion**: Built-in currency conversion system supporting 9 major currencies
- **Shipping Calculation**: Integrated shipping cost calculator with country-specific rates
- **Analytics Ready**: Structured for Google Analytics integration (placeholder implementation)

The application is designed to be easily deployable and scalable, with comprehensive error handling and fallback systems for all external dependencies.