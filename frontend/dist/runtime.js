// Wails Runtime Stub with Calculation Logic
// This file provides browser-compatible implementations of the Go backend

window.go = window.go || {};
window.go.main = window.go.main || {};

// App state for calculations
const appData = {
    maxYRes: 0,
    inputYMax: 0,
    upperBound: 0,
    lowerBound: 0,
    clickCount: 0,
    regularUsage: false,
    addonUsage: false,
    // Standard readings
    january: '', february: '', march: '', april: '', may: '', june: '',
    july: '', august: '', september: '', october: '', november: '', december: '',
    // Addon readings
    janA: '', janB: '', febA: '', febB: '', marA: '', marB: '',
    aprA: '', aprB: '', mayA: '', mayB: '', junA: '', junB: '',
    julA: '', julB: '', augA: '', augB: '', sepA: '', sepB: '',
    octA: '', octB: '', novA: '', novB: '', decA: '', decB: ''
};

// Calculation functions
function calcGraph(ypos) {
    let usage = 0;
    let correctedUsage = 0;
    
    if (ypos < appData.lowerBound) {
        ypos = 0;
    }
    
    if (appData.upperBound !== appData.lowerBound) {
        usage = (ypos - appData.lowerBound) / (appData.upperBound - appData.lowerBound);
        correctedUsage = appData.inputYMax * (usage * 1.01);
    }
    
    if (correctedUsage < 0) {
        correctedUsage = 0;
    }
    
    return String(Math.round(correctedUsage));
}

function calcNet(a, b) {
    const valA = parseInt(a) || 0;
    const valB = parseInt(b) || 0;
    return String(valA - valB);
}

// Mock App object with real calculation logic
window.go.main.App = {
    SetWindowHeight: async function(height) { 
        appData.maxYRes = height;
        console.log('SetWindowHeight:', height); 
    },
    GetWindowHeight: async function() { return window.innerHeight; },
    SetYMax: async function(value) { 
        appData.inputYMax = value;
        console.log('SetYMax:', value); 
    },
    GetYMax: async function() { return appData.inputYMax; },
    StartRegularUsage: async function() { 
        appData.regularUsage = true;
        appData.addonUsage = false;
        appData.clickCount = 0;
        console.log('StartRegularUsage'); 
    },
    StartAddonUsage: async function() { 
        appData.regularUsage = false;
        appData.addonUsage = true;
        appData.clickCount = 0;
        console.log('StartAddonUsage'); 
    },
    GetDescription: async function() { 
        const descriptions = [
            "Click the top of the graph (maximum Y value)",
            "Click the bottom of the graph (origin/zero)",
            "Click January data point",
            "Click February data point",
            "Click March data point",
            "Click April data point",
            "Click May data point",
            "Click June data point",
            "Click July data point",
            "Click August data point",
            "Click September data point",
            "Click October data point",
            "Click November data point",
            "Click December data point",
            "All points captured! Calculations complete."
        ];
        return descriptions[Math.min(appData.clickCount, descriptions.length - 1)];
    },
    GetAddonDescription: async function() { 
        const descriptions = [
            "Click the top of the graph (maximum Y value)",
            "Click the bottom of the graph (origin/zero)",
            "Click January consumption point",
            "Click January generation point",
            "Click February consumption point",
            "Click February generation point",
            "Continue alternating consumption/generation for each month...",
            "All points captured! Calculations complete."
        ];
        return descriptions[Math.min(appData.clickCount, descriptions.length - 1)] || "Continue clicking points...";
    },
    HandleClick: async function(yPos) {
        const correct = appData.maxYRes - yPos;
        const yAxisLocation = correct;
        
        let reading = "";
        
        switch (appData.clickCount) {
            case 0:
                console.log("Maximum set at:", yAxisLocation);
                appData.upperBound = yAxisLocation;
                reading = "Maximum set";
                break;
            case 1:
                console.log("Origin set at:", yAxisLocation);
                appData.lowerBound = yAxisLocation;
                reading = "Origin set";
                break;
            case 2:
                appData.january = calcGraph(yAxisLocation);
                reading = "January: " + appData.january;
                break;
            case 3:
                appData.february = calcGraph(yAxisLocation);
                reading = "February: " + appData.february;
                break;
            case 4:
                appData.march = calcGraph(yAxisLocation);
                reading = "March: " + appData.march;
                break;
            case 5:
                appData.april = calcGraph(yAxisLocation);
                reading = "April: " + appData.april;
                break;
            case 6:
                appData.may = calcGraph(yAxisLocation);
                reading = "May: " + appData.may;
                break;
            case 7:
                appData.june = calcGraph(yAxisLocation);
                reading = "June: " + appData.june;
                break;
            case 8:
                appData.july = calcGraph(yAxisLocation);
                reading = "July: " + appData.july;
                break;
            case 9:
                appData.august = calcGraph(yAxisLocation);
                reading = "August: " + appData.august;
                break;
            case 10:
                appData.september = calcGraph(yAxisLocation);
                reading = "September: " + appData.september;
                break;
            case 11:
                appData.october = calcGraph(yAxisLocation);
                reading = "October: " + appData.october;
                break;
            case 12:
                appData.november = calcGraph(yAxisLocation);
                reading = "November: " + appData.november;
                break;
            case 13:
                appData.december = calcGraph(yAxisLocation);
                reading = "December: " + appData.december;
                break;
            default:
                reading = "Completed";
        }
        
        appData.clickCount++;
        const desc = await this.GetDescription();
        return [reading, desc, null];
    },
    HandleAddonClick: async function(yPos) {
        const correct = appData.maxYRes - yPos;
        const yAxisLocation = correct;
        
        let reading = "";
        
        switch (appData.clickCount) {
            case 0:
                appData.upperBound = yAxisLocation;
                reading = "Maximum set";
                break;
            case 1:
                appData.lowerBound = yAxisLocation;
                reading = "Origin set";
                break;
            case 2:
                appData.janA = calcGraph(yAxisLocation);
                reading = "January consumption recorded";
                break;
            case 3:
                appData.janB = calcGraph(yAxisLocation);
                appData.january = calcNet(appData.janA, appData.janB);
                reading = "January: " + appData.january;
                break;
            case 4:
                appData.febA = calcGraph(yAxisLocation);
                reading = "February consumption recorded";
                break;
            case 5:
                appData.febB = calcGraph(yAxisLocation);
                appData.february = calcNet(appData.febA, appData.febB);
                reading = "February: " + appData.february;
                break;
            // Continue pattern for remaining months...
            case 6:
                appData.marA = calcGraph(yAxisLocation);
                reading = "March consumption recorded";
                break;
            case 7:
                appData.marB = calcGraph(yAxisLocation);
                appData.march = calcNet(appData.marA, appData.marB);
                reading = "March: " + appData.march;
                break;
            case 8:
                appData.aprA = calcGraph(yAxisLocation);
                reading = "April consumption recorded";
                break;
            case 9:
                appData.aprB = calcGraph(yAxisLocation);
                appData.april = calcNet(appData.aprA, appData.aprB);
                reading = "April: " + appData.april;
                break;
            case 10:
                appData.mayA = calcGraph(yAxisLocation);
                reading = "May consumption recorded";
                break;
            case 11:
                appData.mayB = calcGraph(yAxisLocation);
                appData.may = calcNet(appData.mayA, appData.mayB);
                reading = "May: " + appData.may;
                break;
            case 12:
                appData.junA = calcGraph(yAxisLocation);
                reading = "June consumption recorded";
                break;
            case 13:
                appData.junB = calcGraph(yAxisLocation);
                appData.june = calcNet(appData.junA, appData.junB);
                reading = "June: " + appData.june;
                break;
            case 14:
                appData.julA = calcGraph(yAxisLocation);
                reading = "July consumption recorded";
                break;
            case 15:
                appData.julB = calcGraph(yAxisLocation);
                appData.july = calcNet(appData.julA, appData.julB);
                reading = "July: " + appData.july;
                break;
            case 16:
                appData.augA = calcGraph(yAxisLocation);
                reading = "August consumption recorded";
                break;
            case 17:
                appData.augB = calcGraph(yAxisLocation);
                appData.august = calcNet(appData.augA, appData.augB);
                reading = "August: " + appData.august;
                break;
            case 18:
                appData.sepA = calcGraph(yAxisLocation);
                reading = "September consumption recorded";
                break;
            case 19:
                appData.sepB = calcGraph(yAxisLocation);
                appData.september = calcNet(appData.sepA, appData.sepB);
                reading = "September: " + appData.september;
                break;
            case 20:
                appData.octA = calcGraph(yAxisLocation);
                reading = "October consumption recorded";
                break;
            case 21:
                appData.octB = calcGraph(yAxisLocation);
                appData.october = calcNet(appData.octA, appData.octB);
                reading = "October: " + appData.october;
                break;
            case 22:
                appData.novA = calcGraph(yAxisLocation);
                reading = "November consumption recorded";
                break;
            case 23:
                appData.novB = calcGraph(yAxisLocation);
                appData.november = calcNet(appData.novA, appData.novB);
                reading = "November: " + appData.november;
                break;
            case 24:
                appData.decA = calcGraph(yAxisLocation);
                reading = "December consumption recorded";
                break;
            case 25:
                appData.decB = calcGraph(yAxisLocation);
                appData.december = calcNet(appData.decA, appData.decB);
                reading = "December: " + appData.december;
                break;
            default:
                reading = "Completed";
        }
        
        appData.clickCount++;
        const desc = await this.GetAddonDescription();
        return [reading, desc, null];
    },
    GetAllReadings: async function() { 
        if (appData.addonUsage) {
            return `January: ${appData.january}\nFebruary: ${appData.february}\nMarch: ${appData.march}\nApril: ${appData.april}\nMay: ${appData.may}\nJune: ${appData.june}\nJuly: ${appData.july}\nAugust: ${appData.august}\nSeptember: ${appData.september}\nOctober: ${appData.october}\nNovember: ${appData.november}\nDecember: ${appData.december}`;
        }
        return `January: ${appData.january}\nFebruary: ${appData.february}\nMarch: ${appData.march}\nApril: ${appData.april}\nMay: ${appData.may}\nJune: ${appData.june}\nJuly: ${appData.july}\nAugust: ${appData.august}\nSeptember: ${appData.september}\nOctober: ${appData.october}\nNovember: ${appData.november}\nDecember: ${appData.december}`;
    },
    Reset: async function() { 
        appData.clickCount = 0;
        appData.regularUsage = false;
        appData.addonUsage = false;
        console.log('Reset'); 
    },
    IsRegularMode: async function() { return appData.regularUsage; },
    IsAddonMode: async function() { return appData.addonUsage; }
};

// Events API
window.runtime = window.runtime || {};
window.runtime.EventsOn = function(event, callback) { console.log('EventsOn:', event); };
window.runtime.EventsOff = function(event) { console.log('EventsOff:', event); };
window.runtime.EventsEmit = function(event, data) { console.log('EventsEmit:', event, data); };

// Log that runtime is loaded
console.log('Wails runtime stub with calculations loaded');
