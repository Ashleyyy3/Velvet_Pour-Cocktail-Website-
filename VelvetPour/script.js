const {
  cocktails,
  categories,
  pantryGroups
} = cocktailData;

const state = {
  search: '',
  category: 'All',
  favorites: new Set(JSON.parse(localStorage.getItem('velvet-pour-favorites') || '[]')),
  pantry: new Set(JSON.parse(localStorage.getItem('velvet-pour-pantry') || '[]')),
  activeRecipeId: null,
  servings: 1,
  currentStep: 0
};

const elements = {
  recipeGrid: document.getElementById('recipe-grid'),
  favoritesGrid: document.getElementById('favorites-grid'),
  favoritesEmpty: document.getElementById('favorites-empty'),
  categoryChips: document.getElementById('category-chips'),
  searchInput: document.getElementById('search-input'),
  resultsCount: document.getElementById('results-count'),
  clearFilters: document.getElementById('clear-filters'),
  emptyState: document.getElementById('empty-state'),
  emptyReset: document.getElementById('empty-reset'),
  pantryGroups: document.getElementById('pantry-groups'),
  matchSummary: document.getElementById('match-summary'),
  matchResults: document.getElementById('match-results'),
  clearPantry: document.getElementById('clear-pantry'),
  recipeModal: document.getElementById('recipe-modal'),
  recipeModalContent: document.getElementById('recipe-modal-content'),
  mixModal: document.getElementById('mix-modal'),
  mixModalContent: document.getElementById('mix-modal-content'),
  toast: document.getElementById('toast'),
  menuToggle: document.getElementById('menu-toggle'),
  mobileNav: document.getElementById('mobile-nav')
};

function saveState() {
  localStorage.setItem('velvet-pour-favorites', JSON.stringify([...state.favorites]));
  localStorage.setItem('velvet-pour-pantry', JSON.stringify([...state.pantry]));
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 2200);
}

function getRecipeById(id) {
  return cocktails.find((cocktail) => cocktail.id === id);
}

function ingredientNames(cocktail) {
  return cocktail.ingredients.map(([name]) => name);
}

function matchesSearch(cocktail) {
  if (!state.search) return true;

  const text = [
    cocktail.name,
    cocktail.category,
    cocktail.description,
    ...cocktail.flavor,
    ...ingredientNames(cocktail)
  ]
    .join(' ')
    .toLowerCase();

  return text.includes(state.search);
}

function filterCocktails() {
  return cocktails.filter((cocktail) => {
    const categoryMatch = state.category === 'All' || cocktail.category === state.category;
    return categoryMatch && matchesSearch(cocktail);
  });
}

function recipeCardTemplate(cocktail) {
  const saved = state.favorites.has(cocktail.id);

  return `
    <article class="recipe-card reveal visible">
      <img src="${cocktail.image}" alt="${cocktail.name}" />
      <div class="recipe-copy">
        <div class="recipe-meta">
          <span>${cocktail.category}</span>
          <span>${cocktail.time} min</span>
        </div>
        <h3>${cocktail.name}</h3>
        <p class="recipe-summary">${cocktail.description}</p>
        <div class="tags">
          ${cocktail.flavor.map((item) => `<span class="tag">${item}</span>`).join('')}
        </div>
        <div class="card-actions">
          <button class="button button-solid" type="button" data-open-recipe="${cocktail.id}">
            View recipe
          </button>
          <button
            class="icon-button"
            type="button"
            aria-label="${saved ? 'Remove from saved recipes' : 'Save recipe'}"
            data-toggle-favorite="${cocktail.id}"
          >
            ${saved ? '♥' : '♡'}
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderCategoryChips() {
  elements.categoryChips.innerHTML = categories
    .map(
      (category) => `
        <button
          class="chip ${state.category === category ? 'active' : ''}"
          type="button"
          data-set-category="${category}"
        >
          ${category}
        </button>
      `
    )
    .join('');
}

function renderDiscover() {
  const filtered = filterCocktails();

  renderCategoryChips();
  elements.recipeGrid.innerHTML = filtered.map(recipeCardTemplate).join('');
  elements.resultsCount.textContent = `${filtered.length} recipe${filtered.length === 1 ? '' : 's'} available`;

  const filtersActive = state.category !== 'All' || state.search.length > 0;
  elements.clearFilters.hidden = !filtersActive;
  elements.emptyState.hidden = filtered.length !== 0;
}

function renderFavorites() {
  const savedRecipes = cocktails.filter((cocktail) => state.favorites.has(cocktail.id));
  elements.favoritesGrid.innerHTML = savedRecipes.map(recipeCardTemplate).join('');
  elements.favoritesEmpty.hidden = savedRecipes.length !== 0;
}

function toggleFavorite(recipeId) {
  if (state.favorites.has(recipeId)) {
    state.favorites.delete(recipeId);
    showToast('Removed from saved recipes.');
  } else {
    state.favorites.add(recipeId);
    showToast('Saved to your little black book.');
  }

  saveState();
  renderDiscover();
  renderFavorites();

  if (state.activeRecipeId === recipeId) {
    openRecipeModal(recipeId);
  }
}

function renderPantry() {
  elements.pantryGroups.innerHTML = Object.entries(pantryGroups)
    .map(
      ([groupName, items]) => `
        <section class="pantry-group">
          <h3>${groupName}</h3>
          <div class="ingredient-pills">
            ${items
              .map(
                (item) => `
                  <button
                    class="pill ${state.pantry.has(item) ? 'active' : ''}"
                    type="button"
                    data-toggle-ingredient="${item}"
                  >
                    ${state.pantry.has(item) ? '✓' : '+'} ${item}
                  </button>
                `
              )
              .join('')}
          </div>
        </section>
      `
    )
    .join('');

  renderMatches();
}

function renderMatches() {
  const selected = [...state.pantry];

  if (selected.length === 0) {
    elements.matchSummary.textContent = 'Select a few ingredients to see your cocktail matches.';
    elements.matchResults.innerHTML = `
      <div class="empty-state">
        <h3>Your menu starts here</h3>
        <p>Pick ingredients on the left and we will show you the best drinks to make tonight.</p>
      </div>
    `;
    return;
  }

  const ranked = cocktails
    .map((cocktail) => {
      const names = ingredientNames(cocktail);
      const missing = names.filter((name) => !state.pantry.has(name));
      const ownedCount = names.length - missing.length;

      return {
        cocktail,
        missing,
        ownedCount,
        total: names.length
      };
    })
    .sort((a, b) => a.missing.length - b.missing.length || b.ownedCount - a.ownedCount);

  const readyCount = ranked.filter((item) => item.missing.length === 0).length;

  elements.matchSummary.textContent = readyCount
    ? `You can make ${readyCount} cocktail${readyCount === 1 ? '' : 's'} right now.`
    : 'You are close. Your best matches appear first.';

  elements.matchResults.innerHTML = ranked
    .slice(0, 8)
    .map(
      ({ cocktail, missing, ownedCount, total }) => `
        <article class="match-card">
          <img src="${cocktail.image}" alt="${cocktail.name}" />
          <div class="match-copy">
            <p class="match-state ${missing.length ? 'missing' : ''}">
              ${
                missing.length === 0
                  ? 'Ready to mix'
                  : `${ownedCount}/${total} ingredients · ${missing.length} missing`
              }
            </p>
            <h3>${cocktail.name}</h3>
            <p>${missing.length ? `Missing: ${missing.join(', ')}` : 'You have everything for this recipe.'}</p>
          </div>
          <button class="button button-ghost" type="button" data-open-recipe="${cocktail.id}">
            View
          </button>
        </article>
      `
    )
    .join('');
}

function formatAmount(name, amount, servings) {
  const total = amount * servings;
  const rounded = Number.isInteger(total) ? total : Math.round(total * 10) / 10;

  if (name === 'Mint leaves') return `${rounded} leaves`;
  if (name === 'Angostura bitters') return `${rounded} dashes`;
  return `${rounded} ml`;
}

function recipeDetailTemplate(cocktail) {
  const isSaved = state.favorites.has(cocktail.id);

  return `
    <div class="detail-layout">
      <div>
        <img src="${cocktail.image}" alt="${cocktail.name}" />
      </div>

      <div class="detail-copy">
        <p class="eyebrow">${cocktail.category}</p>
        <h1 id="recipe-title">${cocktail.name}</h1>
        <p class="recipe-detail-text">${cocktail.hero}</p>
        <div class="tags">
          ${cocktail.flavor.map((item) => `<span class="tag">${item}</span>`).join('')}
        </div>

        <div class="info-row">
          <div class="info-box">
            <small>Prep time</small>
            <strong>${cocktail.time} minutes</strong>
          </div>
          <div class="info-box">
            <small>Difficulty</small>
            <strong>${cocktail.difficulty}</strong>
          </div>
          <div class="info-box">
            <small>Equipment</small>
            <strong>${cocktail.equipment}</strong>
          </div>
        </div>

        <div class="serving-row">
          <h2>Ingredients</h2>
          <div class="stepper">
            <button type="button" data-serving-change="down" ${state.servings === 1 ? 'disabled' : ''}>−</button>
            <output aria-label="Servings">${state.servings}</output>
            <button type="button" data-serving-change="up" ${state.servings === 8 ? 'disabled' : ''}>+</button>
          </div>
        </div>

        <ul class="ingredients-list">
          ${cocktail.ingredients
            .map(
              ([name, amount]) => `
                <li>
                  <span>${name}</span>
                  <strong>${formatAmount(name, amount, state.servings)}</strong>
                </li>
              `
            )
            .join('')}
          <li>
            <span>Garnish</span>
            <strong>${cocktail.garnish}</strong>
          </li>
        </ul>

        <div class="recipe-actions">
          <button class="button button-solid" type="button" data-start-mix="${cocktail.id}">Start mixing</button>
          <button class="button button-ghost" type="button" data-toggle-favorite="${cocktail.id}">
            ${isSaved ? '♥ Saved recipe' : '♡ Save recipe'}
          </button>
        </div>

        <div class="tip-box">
          <small>House tip</small>
          <p>${cocktail.tip}</p>
        </div>
      </div>
    </div>
  `;
}

function openRecipeModal(recipeId) {
  state.activeRecipeId = recipeId;
  const cocktail = getRecipeById(recipeId);

  if (!cocktail) return;

  elements.recipeModalContent.innerHTML = recipeDetailTemplate(cocktail);
  elements.recipeModal.hidden = false;
  elements.recipeModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeRecipeModal() {
  elements.recipeModal.hidden = true;
  elements.recipeModal.setAttribute('aria-hidden', 'true');
  state.activeRecipeId = null;
  state.servings = 1;
  document.body.style.overflow = '';
}

function mixTemplate(cocktail) {
  const steps = cocktail.steps;
  const complete = state.currentStep >= steps.length;
  const progress = Math.min((state.currentStep / steps.length) * 100, 100);

  return `
    <div class="mix-header">
      <p class="eyebrow">GUIDED MIXING STUDIO</p>
      <h1 id="mix-title">${cocktail.name}</h1>
      <div class="mix-counter">
        <small>${complete ? 'Completed' : `Step ${state.currentStep + 1} of ${steps.length}`}</small>
        <small>${Math.round(progress)}% complete</small>
      </div>
      <div class="progress"><span style="width: ${progress}%"></span></div>
    </div>

    ${
      complete
        ? `
          <div class="mix-layout">
            <div>
              <img src="${cocktail.image}" alt="${cocktail.name}" />
            </div>
            <div class="step-box">
              <h2>Your drink is ready.</h2>
              <p>Beautiful. You just finished a ${cocktail.name}. Time to sip and enjoy.</p>
              <div class="mix-controls">
                <button class="button button-solid" type="button" data-mix-again>Mix again</button>
                <button class="button button-ghost" type="button" data-close-mix>Close</button>
              </div>
            </div>
          </div>
        `
        : `
          <div class="mix-layout">
            <div>
              <img src="${cocktail.image}" alt="${cocktail.name}" />
            </div>
            <div class="step-box">
              <h2>${steps[state.currentStep][0]}</h2>
              <p>${steps[state.currentStep][1]}</p>
              <div class="tip-box">
                <small>Need to know</small>
                <p>${cocktail.tip}</p>
              </div>
              <div class="mix-controls">
                <button
                  class="button button-ghost"
                  type="button"
                  data-step-nav="back"
                  ${state.currentStep === 0 ? 'disabled' : ''}
                >
                  Previous step
                </button>
                <button class="button button-solid" type="button" data-step-nav="next">
                  ${state.currentStep === steps.length - 1 ? 'Finish drink' : 'Next step'}
                </button>
              </div>
            </div>
          </div>
        `
    }
  `;
}

function openMixModal(recipeId) {
  const cocktail = getRecipeById(recipeId);
  if (!cocktail) return;

  state.activeRecipeId = recipeId;
  state.currentStep = 0;
  elements.mixModalContent.innerHTML = mixTemplate(cocktail);
  elements.mixModal.hidden = false;
  elements.mixModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function rerenderMix() {
  const cocktail = getRecipeById(state.activeRecipeId);
  if (!cocktail) return;
  elements.mixModalContent.innerHTML = mixTemplate(cocktail);
}

function closeMixModal() {
  elements.mixModal.hidden = true;
  elements.mixModal.setAttribute('aria-hidden', 'true');
  state.currentStep = 0;
  document.body.style.overflow = '';
}

function toggleIngredient(name) {
  if (state.pantry.has(name)) {
    state.pantry.delete(name);
  } else {
    state.pantry.add(name);
  }

  saveState();
  renderPantry();
}

function bindEvents() {
  elements.searchInput.addEventListener('input', (event) => {
    state.search = event.target.value.trim().toLowerCase();
    renderDiscover();
  });

  elements.clearFilters.addEventListener('click', resetFilters);
  elements.emptyReset.addEventListener('click', resetFilters);

  elements.clearPantry.addEventListener('click', () => {
    state.pantry.clear();
    saveState();
    renderPantry();
    showToast('Home bar cleared.');
  });

  elements.menuToggle.addEventListener('click', () => {
    const isHidden = elements.mobileNav.hidden;
    elements.mobileNav.hidden = !isHidden;
    elements.menuToggle.setAttribute('aria-expanded', String(isHidden));
  });

  document.addEventListener('click', (event) => {
    const categoryButton = event.target.closest('[data-set-category]');
    const favoriteButton = event.target.closest('[data-toggle-favorite]');
    const ingredientButton = event.target.closest('[data-toggle-ingredient]');
    const openRecipeButton = event.target.closest('[data-open-recipe]');
    const closeModalButton = event.target.closest('[data-close-modal]');
    const servingButton = event.target.closest('[data-serving-change]');
    const startMixButton = event.target.closest('[data-start-mix]');
    const stepButton = event.target.closest('[data-step-nav]');
    const closeMixButton = event.target.closest('[data-close-mix]');
    const mixAgainButton = event.target.closest('[data-mix-again]');

    if (categoryButton) {
      state.category = categoryButton.dataset.setCategory;
      renderDiscover();
      return;
    }

    if (favoriteButton) {
      toggleFavorite(favoriteButton.dataset.toggleFavorite);
      return;
    }

    if (ingredientButton) {
      toggleIngredient(ingredientButton.dataset.toggleIngredient);
      return;
    }

    if (openRecipeButton) {
      openRecipeModal(openRecipeButton.dataset.openRecipe);
      return;
    }

    if (closeModalButton) {
      closeRecipeModal();
      return;
    }

    if (servingButton && state.activeRecipeId) {
      if (servingButton.dataset.servingChange === 'up') {
        state.servings = Math.min(8, state.servings + 1);
      } else {
        state.servings = Math.max(1, state.servings - 1);
      }

      openRecipeModal(state.activeRecipeId);
      return;
    }

    if (startMixButton) {
      closeRecipeModal();
      openMixModal(startMixButton.dataset.startMix);
      return;
    }

    if (stepButton) {
      const direction = stepButton.dataset.stepNav;
      const recipe = getRecipeById(state.activeRecipeId);

      if (!recipe) return;

      if (direction === 'next') {
        state.currentStep = Math.min(recipe.steps.length, state.currentStep + 1);
      } else {
        state.currentStep = Math.max(0, state.currentStep - 1);
      }

      rerenderMix();
      return;
    }

    if (closeMixButton) {
      closeMixModal();
      return;
    }

    if (mixAgainButton) {
      state.currentStep = 0;
      rerenderMix();
      return;
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!elements.mixModal.hidden) {
        closeMixModal();
      }

      if (!elements.recipeModal.hidden) {
        closeRecipeModal();
      }
    }
  });

  elements.mobileNav.addEventListener('click', (event) => {
    if (event.target.matches('a')) {
      elements.mobileNav.hidden = true;
      elements.menuToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

function resetFilters() {
  state.search = '';
  state.category = 'All';
  elements.searchInput.value = '';
  renderDiscover();
}

function setupRevealAnimation() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.12
    }
  );

  document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
}

function init() {
  renderDiscover();
  renderFavorites();
  renderPantry();
  bindEvents();
  setupRevealAnimation();
}

init();
