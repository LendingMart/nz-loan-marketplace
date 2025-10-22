// js/api.js - Complete data fetching functions

class LoanAPI {
    constructor() {
        this.baseUrl = window.location.origin;
        this.products = [];
        this.categories = [];
        this.isLoaded = false;
    }

    // Load products from JSON file
    async loadProducts() {
        try {
            console.log('Loading products from data/products.json...');
            const response = await fetch('./data/products.json');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.products = data.products || [];
            this.categories = data.categories || [];
            this.isLoaded = true;
            
            console.log(`Successfully loaded ${this.products.length} products and ${this.categories.length} categories`);
            return this.products;
            
        } catch (error) {
            console.error('Failed to load products:', error);
            // Fallback to empty arrays
            this.products = [];
            this.categories = [];
            this.isLoaded = false;
            throw error;
        }
    }

    // Get all active products
    async getAllProducts() {
        if (!this.isLoaded) {
            await this.loadProducts();
        }
        return this.products.filter(product => product.isActive !== false);
    }

    // Get featured products (for homepage)
    async getFeaturedProducts(limit = 6) {
        const products = await this.getAllProducts();
        return products
            .filter(product => product.popularity === 'Very High' || product.popularity === 'High')
            .slice(0, limit);
    }

    // Get product by ID
    async getProductById(id) {
        const products = await this.getAllProducts();
        return products.find(product => product.id === parseInt(id));
    }

    // Get products by category
    async getProductsByCategory(category) {
        const products = await this.getAllProducts();
        if (!category) return products;
        return products.filter(product => product.category === category);
    }

    // Get products with multiple filters
    async getFilteredProducts(filters = {}) {
        let products = await this.getAllProducts();

        // Category filter
        if (filters.category) {
            products = products.filter(product => product.category === filters.category);
        }

        // Amount filter
        if (filters.amountRange) {
            products = products.filter(product => {
                if (product.amount === "N/A") return false;
                const amount = this.parseLoanAmount(product.amount);
                return amount.max >= filters.amountRange.min && 
                       amount.min <= filters.amountRange.max;
            });
        }

        // Approval rate filter
        if (filters.minApprovalRate) {
            const rateOrder = { 'Low': 1, 'Medium': 2, 'High': 3, 'Very High': 4 };
            products = products.filter(product => 
                product.approvalRate && 
                rateOrder[product.approvalRate] >= rateOrder[filters.minApprovalRate]
            );
        }

        // Popularity filter
        if (filters.minPopularity) {
            const popularityOrder = { 'Low': 1, 'Medium': 2, 'High': 3, 'Very High': 4 };
            products = products.filter(product => 
                product.popularity && 
                popularityOrder[product.popularity] >= popularityOrder[filters.minPopularity]
            );
        }

        // Search filter
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            products = products.filter(product =>
                product.company.toLowerCase().includes(searchTerm) ||
                product.product.toLowerCase().includes(searchTerm) ||
                product.category.toLowerCase().includes(searchTerm) ||
                (product.description && product.description.toLowerCase().includes(searchTerm))
            );
        }

        return products;
    }

    // Parse loan amount string to numeric range
    parseLoanAmount(amountStr) {
        if (!amountStr || amountStr === "N/A") {
            return { min: 0, max: 0 };
        }

        if (amountStr.includes('Up to')) {
            const match = amountStr.match(/\$([0-9,]+)/);
            return { 
                min: 0, 
                max: match ? parseInt(match[1].replace(/,/g, '')) : 0 
            };
        }
        
        const amounts = amountStr.match(/\$([0-9,]+)/g);
        if (amounts && amounts.length === 2) {
            return {
                min: parseInt(amounts[0].replace(/[$,]/g, '')),
                max: parseInt(amounts[1].replace(/[$,]/g, ''))
            };
        }
        
        return { min: 0, max: 0 };
    }

    // Get unique categories
    async getCategories() {
        if (!this.isLoaded) {
            await this.loadProducts();
        }
        return this.categories;
    }

    // Search products
    async searchProducts(query) {
        const products = await this.getAllProducts();
        if (!query) return products;
        
        const searchTerm = query.toLowerCase();
        return products.filter(product =>
            product.company.toLowerCase().includes(searchTerm) ||
            product.product.toLowerCase().includes(searchTerm) ||
            product.category.toLowerCase().includes(searchTerm) ||
            (product.description && product.description.toLowerCase().includes(searchTerm))
        );
    }

    // Get products by popularity
    async getProductsByPopularity(minPopularity = 'High') {
        const products = await this.getAllProducts();
        const popularityOrder = { 'Low': 1, 'Medium': 2, 'High': 3, 'Very High': 4 };
        
        return products.filter(product => 
            product.popularity && 
            popularityOrder[product.popularity] >= popularityOrder[minPopularity]
        );
    }

    // Get statistics about products
    async getProductStats() {
        const products = await this.getAllProducts();
        
        const stats = {
            total: products.length,
            byCategory: {},
            byApprovalRate: {},
            byPopularity: {}
        };

        products.forEach(product => {
            // Count by category
            stats.byCategory[product.category] = (stats.byCategory[product.category] || 0) + 1;
            
            // Count by approval rate
            stats.byApprovalRate[product.approvalRate] = (stats.byApprovalRate[product.approvalRate] || 0) + 1;
            
            // Count by popularity
            stats.byPopularity[product.popularity] = (stats.byPopularity[product.popularity] || 0) + 1;
        });

        return stats;
    }
}

// Click tracking functions (unchanged)
class ClickTracker {
    constructor() {
        this.clicks = this.loadClicks();
    }

    loadClicks() {
        try {
            return JSON.parse(localStorage.getItem('nz_product_clicks')) || [];
        } catch (error) {
            console.error('Failed to load clicks:', error);
            return [];
        }
    }

    saveClicks() {
        try {
            localStorage.setItem('nz_product_clicks', JSON.stringify(this.clicks));
        } catch (error) {
            console.error('Failed to save clicks:', error);
        }
    }

    recordClick(productId, productName, commission, additionalData = {}) {
        const clickData = {
            id: Date.now(),
            productId,
            productName,
            commission,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            referrer: document.referrer,
            ...additionalData
        };

        this.clicks.push(clickData);
        
        // Keep only last 1000 clicks to prevent storage overflow
        if (this.clicks.length > 1000) {
            this.clicks = this.clicks.slice(-500);
        }
        
        this.saveClicks();
        
        // Send to Google Analytics
        if (typeof gtag !== 'undefined') {
            gtag('event', 'product_click', {
                'product_id': productId,
                'product_name': productName,
                'commission': commission,
                'event_category': 'nz_loan_products',
                'currency': 'NZD'
            });
        }

        return clickData;
    }

    getClickStats() {
        const today = new Date().toDateString();
        const allClicks = this.clicks;
        const todayClicks = allClicks.filter(click => 
            new Date(click.timestamp).toDateString() === today
        );
        
        const totalRevenue = allClicks.reduce((sum, click) => sum + (click.commission || 0), 0);
        const todayRevenue = todayClicks.reduce((sum, click) => sum + (click.commission || 0), 0);

        return {
            totalClicks: allClicks.length,
            todayClicks: todayClicks.length,
            totalRevenue,
            todayRevenue
        };
    }

    getProductStats(products) {
        const stats = {};
        products.forEach(product => {
            const productClicks = this.clicks.filter(click => click.productId === product.id);
            stats[product.id] = {
                totalClicks: productClicks.length,
                todayClicks: productClicks.filter(click => 
                    new Date(click.timestamp).toDateString() === new Date().toDateString()
                ).length,
                totalRevenue: productClicks.reduce((sum, click) => sum + (click.commission || 0), 0)
            };
        });
        return stats;
    }
}

// Create global instances
const loanAPI = new LoanAPI();
const clickTracker = new ClickTracker();