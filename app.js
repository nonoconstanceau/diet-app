const { createApp } = Vue

createApp({
    data() {
        return {
            currentTab: 'today', 
            subTab: 'meals', 
            database: typeof ALIMENTS_STORAGE !== 'undefined' ? ALIMENTS_STORAGE : [],
            activeProfile: 'Profil 1',
            profiles: { 'Profil 1': { history: {}, targetDaily: 1800 } },
            currentDay: null, 
            history: {}, 
            targetDaily: 1800,
            tempSportName: '', 
            tempSportKcal: '', 
            activeTooltip: null,
            storageKey: 'diet_multi_session_v1'
        }
    },
    computed: {
        todayKey() { return new Date().toISOString().split('T')[0]; },
        dateLabel() { 
            if (!this.currentDay) return ''; 
            return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(this.currentDay.dateKey || this.todayKey)); 
        },

        // --- CIBLES MACROS DYNAMIQUES (Ratios: 128p / 190g / 65l pour 1800 kcal) ---
        targetMacros() {
            return {
                p: Math.round((this.targetDaily * 0.2844) / 4),
                g: Math.round((this.targetDaily * 0.4222) / 4),
                l: Math.round((this.targetDaily * 0.3250) / 9)
            };
        },

        // --- CALCUL DES MACROS RÉELLES CONSOMMÉES ---
        totalMacros() {
            if (!this.currentDay) return { p: 0, g: 0, l: 0 };
            let p = 0, g = 0, l = 0;
            const processItems = (items) => {
                if(!items) return;
                items.forEach(item => {
                    const food = this.database.find(f => f.name === item.name);
                    if (food) {
                        p += ((food.p || 0) * item.qty) / 100;
                        g += ((food.g || 0) * item.qty) / 100;
                        l += ((food.l || 0) * item.qty) / 100;
                    }
                });
            };
            this.currentDay.meals.forEach(meal => processItems(meal.items));
            processItems(this.currentDay.extras.items);
            return { p: Math.round(p), g: Math.round(g), l: Math.round(l) };
        },

        totalConsumed() { 
            if(!this.currentDay) return 0; 
            const m = this.currentDay.meals.reduce((s, m) => s + (parseFloat(m.actualKcal) || 0), 0);
            const e = (this.currentDay.extras && this.currentDay.extras.items) ? this.currentDay.extras.items.reduce((s, i) => s + (parseFloat(i.kcal) || 0), 0) : 0;
            return m + e;
        },
        totalBurned() { return this.currentDay && this.currentDay.activities ? this.currentDay.activities.reduce((s, a) => s + (parseFloat(a.kcal) || 0), 0) : 0; },
        remainingKcal() { return this.targetDaily - this.totalConsumed; },
        progressPercent() { return (this.totalConsumed / (this.targetDaily || 1)) * 100; },
        
        currentDelta() { 
            if(!this.currentDay) return 0; 
            const mealDelta = this.currentDay.meals.reduce((d, m) => m.saved ? d + (m.actualKcal - (m.baseWeight * this.targetDaily)) : d, 0);
            const extrasKcal = (this.currentDay.extras && this.currentDay.extras.items) ? this.currentDay.extras.items.reduce((s, i) => s + (parseFloat(i.kcal) || 0), 0) : 0;
            return mealDelta + extrasKcal;
        },
        sortedHistory() { return Object.keys(this.history).sort().reverse().reduce((obj, key) => { obj[key] = this.history[key]; return obj; }, {}); }
    },
    methods: {
        save() { 
            if (this.currentDay) { 
                this.currentDay.totalKcal = this.totalConsumed; 
                this.history[this.currentDay.dateKey] = JSON.parse(JSON.stringify(this.currentDay)); 
                this.profiles[this.activeProfile] = { history: JSON.parse(JSON.stringify(this.history)), targetDaily: this.targetDaily };
                localStorage.setItem(this.storageKey, JSON.stringify(this.profiles)); 
            } 
        },
        loadProfileData() {
            const data = this.profiles[this.activeProfile];
            this.history = data.history || {};
            this.targetDaily = data.targetDaily || 1800;
            if (this.history[this.todayKey]) { 
                this.currentDay = JSON.parse(JSON.stringify(this.history[this.todayKey])); 
            } else { this.resetCurrentDay(); }
        },
        resetCurrentDay() {
            this.currentDay = {
                dateKey: this.todayKey, totalKcal: 0, activities: [], waterCount: 0,
                meals: [
                    { 
                        name: "🍳 Petit-Déjeuner", baseWeight: 0.22, 
                        items: [], actualKcal: 0, saved: false, tempFoodName: "", tempQty: "", showSuggestions: false, 
                        planSections: [
                            { title: "Base", choices: [{ n: "Pain Complet / Nordique", b: 45 }, { n: "Œuf", b: 100 }, { n: "Jambon blanc", b: 60 }] },
                            { title: "Gras / Tartinable", choices: [{ n: "Graines (mélange)", b: 10 }, { n: "Avocat", b: 30 }, { n: "Beurre", b: 8 }, { n: "Carré frais 0%", b: 25 }] },
                            { title: "Boisson / Fruit", choices: [{ n: "Lait d'avoine", b: 100 }, { n: "Fruit (moyenne)", b: 100 }] }
                        ] 
                    },
                    { 
                        name: "🍽️ Déjeuner", baseWeight: 0.32, 
                        items: [], actualKcal: 0, saved: false, tempFoodName: "", tempQty: "", showSuggestions: false, 
                        planSections: [
                            { title: "Féculents (1 choix)", choices: [{ n: "Riz (cuit)", b: 150 }, { n: "Pâtes (cuites)", b: 150 }, { n: "Pomme de terre (cuite)", b: 190 }, { n: "Patate douce (cuite)", b: 170 }, { n: "Gnocchis (cuits)", b: 110 }, { n: "Wrap / Tortilla", b: 70 }, { n: "Pain", b: 85 }, { n: "Quinoa cuit", b: 180 }] },
                            { title: "Protéines (1 au choix)", choices: [{ n: "Poulet / Poisson / Viande", b: 140 }, { n: "Tofu", b: 235 }, { n: "PST (réhydratées)", b: 170 }, { n: "Légumineuses (cuites)", b: 125 }] },
                            { title: "Accompagnements", choices: [{ n: "Légumes (verts moyenne)", b: 200 }, { n: "Huile", b: 10 }, { n: "Fruit (moyenne)", b: 100 }, { n: "Activia", b: 125 }] }
                        ] 
                    },
                    { 
                        name: "☕ Collation", baseWeight: 0.17, 
                        items: [], actualKcal: 0, saved: false, tempFoodName: "", tempQty: "", showSuggestions: false, 
                        planSections: [
                            { title: "🥞 Option Pancake", choices: [{ n: "Flocons d'avoine", b: 30 }, { n: "Skyr", b: 100 }, { n: "Œuf", b: 50 }, { n: "Chocolat (noir 70%)", b: 10 }, { n: "Fruit (moyenne)", b: 100 }] },
                            { title: "🥣 Option Bol", choices: [{ n: "Skyr", b: 150 }, { n: "Muesli", b: 25 }, { n: "Fruit (moyenne)", b: 100 }] },
                            { title: "🧂 Option Wasa", choices: [{ n: "Wasa", b: 30 }, { n: "Skyr", b: 100 }, { n: "Jambon blanc", b: 40 }, { n: "Thon (naturel)", b: 60 }] }
                        ] 
                    },
                    { 
                        name: "🍲 Dîner", baseWeight: 0.29, 
                        items: [], actualKcal: 0, saved: false, tempFoodName: "", tempQty: "", showSuggestions: false, 
                        planSections: [
                            { title: "Féculents (1 choix)", choices: [{ n: "Riz (cuit)", b: 120 }, { n: "Pâtes (cuites)", b: 120 }, { n: "Pomme de terre (cuite)", b: 130 }, { n: "Patate douce (cuite)", b: 120 }, { n: "Gnocchis (cuits)", b: 90 }, { n: "Wrap / Tortilla", b: 60 }, { n: "Pain", b: 70 }, { n: "Quinoa cuit", b: 150 }] },
                            { title: "Protéines (1 au choix)", choices: [{ n: "Poulet / Poisson / Viande", b: 140 }, { n: "Tofu", b: 235 }] },
                            { title: "Accompagnements", choices: [{ n: "Légumes (verts moyenne)", b: 200 }, { n: "Huile", b: 10 }, { n: "Skyr", b: 100 }, { n: "Miel", b: 5 }] }
                        ] 
                    }
                ],
                extras: { name: "Extras", items: [], tempFoodName: "", tempQty: "", showSuggestions: false }
            };
            this.save();
        },
        getAdaptedTarget(meal) { 
            const baseTarget = meal.baseWeight * this.targetDaily;
            const remainingMeals = this.currentDay.meals.filter(m => !m.saved);
            if (remainingMeals.length === 0 || meal.saved) return baseTarget;
            return Math.max(0, baseTarget - (this.currentDelta / remainingMeals.length)); 
        },
        calculateQty(meal, baseQty) { 
            const ratio = this.getAdaptedTarget(meal) / (meal.baseWeight * 1800);
            return Math.round(baseQty * ratio); 
        },
        addFoodToMeal(meal) { 
            const food = this.database.find(f => f.name === meal.tempFoodName);
            if(food && meal.tempQty > 0) {
                meal.items.push({ 
                    name: food.name, 
                    qty: meal.tempQty, 
                    kcal: (food.kcal100 * meal.tempQty) / 100 
                });
                meal.actualKcal = meal.items.reduce((s, i) => s + i.kcal, 0);
                meal.tempFoodName = ""; meal.tempQty = ""; meal.showSuggestions = false; 
                this.save();
            }
        },
        removeFood(meal, i) { meal.items.splice(i, 1); meal.actualKcal = meal.items.reduce((s, i) => s + (i.kcal || 0), 0); this.save(); },
        addSport() { if(this.tempSportName && this.tempSportKcal > 0) { this.currentDay.activities.push({ name: this.tempSportName, kcal: parseFloat(this.tempSportKcal) }); this.tempSportName = ''; this.tempSportKcal = ''; this.save(); } },
        removeSport(i) { this.currentDay.activities.splice(i, 1); this.save(); },
        addWater() { this.currentDay.waterCount++; this.save(); },
        toggleSave(meal) { meal.saved = !meal.saved; this.save(); },
        formatDate(d) { return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' }).format(new Date(d)); },
        loadDayFromHistory(date) { this.currentDay = JSON.parse(JSON.stringify(this.history[date])); this.currentTab = 'today'; },
        getFilteredSuggestions(query) {
            if (!query || query.length < 2) return [];
            return this.database.filter(f => f.name.toLowerCase().includes(query.toLowerCase())).slice(0, 15);
        },
        selectFood(meal, name) { meal.tempFoodName = name; meal.showSuggestions = false; },
        toggleTooltip(mealName) { this.activeTooltip = (this.activeTooltip === mealName) ? null : mealName; },
        closeAllTooltips() { this.activeTooltip = null; },
        switchProfile(name) { this.activeProfile = name; this.loadProfileData(); },
        renameProfile() {
            const newName = prompt("Nom de la session :", this.activeProfile);
            if (newName && newName !== this.activeProfile) {
                this.profiles[newName] = JSON.parse(JSON.stringify(this.profiles[this.activeProfile]));
                delete this.profiles[this.activeProfile];
                this.activeProfile = newName;
                this.save();
            }
        },
        initApp() {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) { this.profiles = JSON.parse(saved); }
            this.activeProfile = Object.keys(this.profiles)[0];
            this.loadProfileData();
        },
        exportData() {
            const dataStr = JSON.stringify(this.profiles, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url; link.download = `diet_backup_${this.todayKey}.json`;
            link.click(); URL.revokeObjectURL(url);
        },
        triggerImport() { document.getElementById('importInput').click(); },
        importData(event) {
            const file = event.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    if (confirm("Restaurer ? Cela écrasera les données actuelles.")) {
                        this.profiles = imported;
                        localStorage.setItem(this.storageKey, JSON.stringify(this.profiles));
                        location.reload();
                    }
                } catch (err) { alert("Fichier invalide."); }
            };
            reader.readAsText(file);
        }
    },
    created() { this.initApp(); }
}).mount('#app')