var current_tender_address = "";
var current_contract_address = "";

Vue.component('existing-tenders', {
  template: '#existing-tenders',
  data: function(){
    return {
      existingTenders: []      
    }
  },
  mounted(){
    this.existingTenders = getExistingTenders();
  },
  methods: {
    tenderInfo : function(event){
      this.$parent.currentView = 'tender-info';
      event.preventDefault();
      var tender_address = event.srcElement.id;
      console.log(tender_address);
      current_tender_address = tender_address;
    }
  }
})

Vue.component('ongoing-contracts', {
  template: '#ongoing-contracts',
  data: function(){
    return {
      ongoingContracts:[]
    }
  },
  mounted(){
    this.ongoingContracts = getOngoingContracts();
  },
  methods: {
    ongoingContractDetails : function(event){
      this.$parent.currentView = 'cm-ongoing-contract-details';
      event.preventDefault();
      var contract_address = event.srcElement.id;
      current_contract_address = contract_address;
      console.log(contract_address);
    }
  }
})

Vue.component('tender-info', {
  template: '#tender-info',
  data:function(){
    return{
      name:'',
      id:'',
      coverCount:0,
      milestoneCount:0,
      bidSubmissionClosingDate:'',
      bidOpeningDate:'',
      clauses:[],
      milestones:[]
    }
  },
  mounted(){
    var res = getTenderInfo(current_tender_address);
    var basic = res.basic;
    var adv = res.advanced;
    this.name = basic.tenderName;
    this.id = basic.tenderId;
    this.coverCount = basic.covers;
    this.milestoneCount = advanced.taskName.length;
    this.bidSubmissionClosingDate = basic.bidSubmissionClosingDate;
    this.bidOpeningDate = basic.bidOpeningDate;
    
    var clauses = advanced.clauses;
    var len = clauses.length;
    for(var i=0;i<len;i++){
      var str = clauses[i];
      this.clauses.push({name:str});
    }

    var tasks = advanced.taskName;
    var tdays = advanced.taskDays;
    var tlen = tasks.length;
    for(var i =0;i<tlen;i++){
      this.milestones.push({
        name:tasks[i],
        noOfDays:tdays[i]
      });
    }
  }
})

Vue.component('cm-ongoing-contract-details', {
  template: '#cm-ongoing-contract-details',
  data:function(){
    return{
      name:'',
      id:'',
      contractCompletionDate:'',
      milestoneCount:0,
      finalQuotationAmount:0,
      contractStartingDate:'',
      contractorAddress:'',
      clauses:[],
      milestones:[]
    }
  },
  mounted(){
    var res = getOngoingContractDetails(current_contract_address);
    var basic = res.basic;
    var advanced = res.advanced;
    this.name = advanced.contractName;
    this.id = basic.tenderId;
    this.milestoneCount = advanced.tasks.length;
    this.contractStartingDate = basic.creationDate;
    this.contractorAddress = basic.contractorAddress;
    this.finalQuotationAmount = advanced.finalQuotationAmount;
    this.contractCompletionDate = basic.CompletionDate;


    var constraints = advanced.constraints;
    var len = constraints.length;

    for(var i=0;i<len;i++){
      this.clauses.push({
        name:constraints[i]
      });
    }

 // ERROR YENAR
   var tasks = res.tasks;
   var tlen = tasks.length;
   for(var i=0 ;i<tlen;i++){
      var obj = tasks[i];
      this.milestones.push({
          name:obj.description,
          deadline:obj.deadlineTime,
          status:obj.status
      });
   }


  },
  methods: {
    viewDocs: function(){
      this.$parent.currentView = 'view-submitted-docs';
    }
  }
  
})

Vue.component('view-submitted-docs', {
  template: '#view-submitted-docs',
})

// Tender Summaries Component
Vue.component('tender-summaries', {
  template: '#tender-summaries',
  data: function() {
    return {
      summaries: [],
      filteredSummaries: [],
      statistics: null,
      loadingSummaries: false,
      searchQuery: '',
      filterWorkType: '',
      filterLocation: '',
      currentPage: 1,
      itemsPerPage: 6,
      selectedSummary: null
    }
  },
  computed: {
    paginatedSummaries: function() {
      const start = (this.currentPage - 1) * this.itemsPerPage;
      const end = start + this.itemsPerPage;
      return this.filteredSummaries.slice(start, end);
    },
    totalPages: function() {
      return Math.ceil(this.filteredSummaries.length / this.itemsPerPage);
    },
    visiblePages: function() {
      const pages = [];
      const start = Math.max(1, this.currentPage - 2);
      const end = Math.min(this.totalPages, this.currentPage + 2);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      return pages;
    },
    mostCommonCategory: function() {
      if (!this.statistics || !this.statistics.categoryBreakdown || this.statistics.categoryBreakdown.length === 0) {
        return 'N/A';
      }
      return this.statistics.categoryBreakdown[0]._id || 'N/A';
    },
    avgConfidence: function() {
      if (!this.statistics || !this.statistics.categoryBreakdown || this.statistics.categoryBreakdown.length === 0) {
        return 0;
      }
      const total = this.statistics.categoryBreakdown.reduce((sum, cat) => sum + (cat.avgConfidence || 0), 0);
      return Math.round(total / this.statistics.categoryBreakdown.length);
    }
  },
  mounted: function() {
    this.loadSummaries();
    this.loadStatistics();
  },
  methods: {
    loadSummaries: async function() {
      this.loadingSummaries = true;
      try {
        // Use the backend API endpoint
        const response = await fetch('http://localhost:3001/api/files/public-summaries?limit=50');
        if (!response.ok) {
          throw new Error('Failed to fetch summaries');
        }
        const data = await response.json();
        this.summaries = data.summaries || [];
        this.filteredSummaries = [...this.summaries];
      } catch (error) {
        console.error('Error loading summaries:', error);
        // For demo purposes, use mock data if API is not available
        this.loadMockSummaries();
      } finally {
        this.loadingSummaries = false;
      }
    },
    loadStatistics: async function() {
      try {
        const response = await fetch('http://localhost:3001/api/files/statistics');
        if (response.ok) {
          this.statistics = await response.json();
        }
      } catch (error) {
        console.error('Error loading statistics:', error);
      }
    },
    loadMockSummaries: function() {
      // Mock data for demonstration when backend is not available
      this.summaries = [
        {
          tenderId: 'TND001',
          tenderAddress: '0x1234...abcd',
          fileName: 'Road Construction Tender.pdf',
          category: 'roads',
          processedAt: new Date().toISOString(),
          summary: {
            overview: 'Construction of 5km concrete road connecting Village A to Highway B with proper drainage systems.',
            workType: 'Roads',
            estimatedValue: '₹50,00,000',
            location: 'Village A, District XYZ',
            timeline: '6 months',
            projectScope: 'Complete road construction with drainage and street lighting.',
            keyRequirements: ['Quality concrete grade M30', 'Proper drainage system', 'Street lighting installation'],
            confidence: 85
          }
        },
        {
          tenderId: 'TND002',
          tenderAddress: '0x5678...efgh',
          fileName: 'School Building Construction.pdf',
          category: 'construction',
          processedAt: new Date().toISOString(),
          summary: {
            overview: 'Construction of new primary school building with 8 classrooms, library, and administrative block.',
            workType: 'Construction',
            estimatedValue: '₹1,20,00,000',
            location: 'Town B, District ABC',
            timeline: '12 months',
            projectScope: 'Complete school infrastructure with modern amenities.',
            keyRequirements: ['Earthquake resistant design', 'Child-friendly facilities', 'Disabled access'],
            confidence: 92
          }
        }
      ];
      this.filteredSummaries = [...this.summaries];
    },
    searchSummaries: function() {
      this.filterSummaries();
    },
    filterSummaries: function() {
      let filtered = [...this.summaries];
      
      // Text search
      if (this.searchQuery.trim()) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(summary => 
          summary.summary.overview.toLowerCase().includes(query) ||
          summary.summary.workType.toLowerCase().includes(query) ||
          summary.summary.location.toLowerCase().includes(query) ||
          summary.summary.projectScope.toLowerCase().includes(query)
        );
      }
      
      // Work type filter
      if (this.filterWorkType) {
        filtered = filtered.filter(summary => 
          summary.summary.workType === this.filterWorkType
        );
      }
      
      // Location filter
      if (this.filterLocation.trim()) {
        const location = this.filterLocation.toLowerCase();
        filtered = filtered.filter(summary => 
          summary.summary.location.toLowerCase().includes(location)
        );
      }
      
      this.filteredSummaries = filtered;
      this.currentPage = 1; // Reset to first page
    },
    changePage: function(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page;
      }
    },
    viewFullSummary: function(summary) {
      this.selectedSummary = summary;
      
      // Populate modal content manually since we're not using a separate modal component
      const modalTitle = document.getElementById('summaryModalTitle');
      const modalBody = document.getElementById('summaryModalBody');
      
      if (modalTitle) modalTitle.textContent = summary.fileName;
      
      if (modalBody) {
        const confidenceBadgeClass = this.getConfidenceBadge(summary.summary.confidence);
        modalBody.innerHTML = `
          <div class="row">
            <div class="col-md-6">
              <h5>Basic Information</h5>
              <table class="table table-bordered">
                <tr><td><strong>Tender ID</strong></td><td>${summary.tenderId}</td></tr>
                <tr><td><strong>Work Type</strong></td><td>${summary.summary.workType}</td></tr>
                <tr><td><strong>Location</strong></td><td>${summary.summary.location}</td></tr>
                <tr><td><strong>Estimated Value</strong></td><td>${summary.summary.estimatedValue}</td></tr>
                <tr><td><strong>Timeline</strong></td><td>${summary.summary.timeline}</td></tr>
                <tr><td><strong>Category</strong></td><td><span class="badge badge-info">${summary.category}</span></td></tr>
                <tr><td><strong>Confidence</strong></td><td><span class="${confidenceBadgeClass}">${summary.summary.confidence}%</span></td></tr>
              </table>
            </div>
            <div class="col-md-6">
              <h5>Key Requirements</h5>
              ${summary.summary.keyRequirements.length > 0 ? 
                '<ul class="list-group">' + summary.summary.keyRequirements.map(req => `<li class="list-group-item">${req}</li>`).join('') + '</ul>' :
                '<p class="text-muted">No specific requirements extracted</p>'
              }
            </div>
          </div>
          <div class="row" style="margin-top: 20px;">
            <div class="col-md-12">
              <h5>Project Overview</h5>
              <div class="well" style="background: #f8f9fa; padding: 15px; border-radius: 5px;">${summary.summary.overview}</div>
            </div>
          </div>
          <div class="row">
            <div class="col-md-12">
              <h5>Project Scope</h5>
              <div class="well" style="background: #f8f9fa; padding: 15px; border-radius: 5px;">${summary.summary.projectScope}</div>
            </div>
          </div>
        `;
      }
      
      $('#summaryModal').modal('show');
    },
    formatDate: function(dateString) {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    },
    truncateText: function(text, maxLength) {
      if (!text || text.length <= maxLength) return text || '';
      return text.substring(0, maxLength) + '...';
    },
    getCategoryColor: function(category) {
      const colors = {
        'roads': 'card-header-warning',
        'construction': 'card-header-info',
        'bridges': 'card-header-success',
        'water': 'card-header-primary',
        'electrical': 'card-header-rose',
        'maintenance': 'card-header-default',
        'supply': 'card-header-dark'
      };
      return colors[category] || 'card-header-info';
    },
    getConfidenceBadge: function(confidence) {
      if (confidence >= 80) return 'badge badge-success';
      if (confidence >= 60) return 'badge badge-warning';
      return 'badge badge-danger';
    }
  }
})

// Full Summary Modal Component
Vue.component('full-summary-modal', {
  template: '#full-summary-modal',
  props: ['selectedSummary'],
  methods: {
    getConfidenceBadge: function(confidence) {
      if (confidence >= 80) return 'badge badge-success';
      if (confidence >= 60) return 'badge badge-warning';
      return 'badge badge-danger';
    }
  }
})

new Vue({
  el: '#app',
  data: {
    currentView: 'existing-tenders',
    isExTender : true,
    isOnContract : false,
    isTenderSummaries: false,
  },
  methods: {
    existingTender: function(){
      this.currentView = 'existing-tenders';
      this.isExTender = true;
      this.isOnContract = false;
      this.isTenderSummaries = false;
    },
    ongoingContract: function(){
      this.currentView = 'ongoing-contracts';
      this.isExTender = false;
      this.isOnContract = true;
      this.isTenderSummaries = false;
    },
    tenderSummaries: function(){
      this.currentView = 'tender-summaries';
      this.isExTender = false;
      this.isOnContract = false;
      this.isTenderSummaries = true;
    }
  }
})
