// Parallax for the hero background (keeps background grounded)
const hero = document.querySelector('.hero');
const PARALLAX_SPEED = 0.3; // tweak between ~0.03 (subtle) and 0.5 (strong)
let ticking = false;

const updateParallax = () => {
	if (!hero) return;
	const rect = hero.getBoundingClientRect();
	const elementCenterY = rect.top + rect.height / 2;
	const viewportCenterY = window.innerHeight / 2;
	// delta is positive when viewport center is below element center
	const delta = (viewportCenterY - elementCenterY) * PARALLAX_SPEED;
	// use calc so the baseline is 50% (center) and we offset in pixels
	hero.style.backgroundPosition = `center calc(50% + ${delta}px)`;
};

const onScroll = () => {
	if (!ticking) {
		ticking = true;
		requestAnimationFrame(() => {
			updateParallax();
			ticking = false;
		});
	}
};

// init and hook events
updateParallax();
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', updateParallax);

// Navbar: toggle semi-transparent background when not at the top
(function () {
	const topNav = document.querySelector('.top-nav');
	const hero = document.querySelector('.hero');
	if (!topNav || !hero) return;

	// Compute a progress value (0..1) while scrolling through the hero
	// and smoothly lerp alpha and blur toward targets for a pleasant effect.
	const MAX_ALPHA = 0.65; // final semi-transparent alpha
	const START_AT = 0.5; // begin fade at 50% of hero
	const MAX_BLUR = 3; // px at maximum

	let targetAlpha = 0;
	let currentAlpha = 0;
	let targetBlur = 0;
	let currentBlur = 0;
	let rafId = null;

	function updateTargets() {
		const heroHeight = hero.offsetHeight || 1;
		const scroll = Math.max(window.scrollY, 0);
		let progress = scroll / heroHeight;
		if (progress < 0) progress = 0;
		if (progress > 1) progress = 1;

		// compute target alpha (0..MAX_ALPHA), starting at START_AT
		if (progress > START_AT) {
			const t = (progress - START_AT) / (1 - START_AT);
			targetAlpha = Math.min(1, Math.max(0, t)) * MAX_ALPHA;
		} else {
			targetAlpha = 0;
		}

		// map alpha proportionally to blur amount (fraction of MAX_BLUR)
		const fraction = MAX_ALPHA > 0 ? targetAlpha / MAX_ALPHA : 0;
		targetBlur = fraction * MAX_BLUR;

		// ensure class reflects visible state for fallback
		if (targetAlpha > 0.001) topNav.classList.add('top-nav--scrolled');
		else topNav.classList.remove('top-nav--scrolled');

		// start animation loop if needed
		if (rafId === null) {
			rafId = requestAnimationFrame(animateNav);
		}
	}

	function animateNav() {
		// lerp towards target values
		const ease = 0.16; // lerp factor (0..1) — smaller == smoother
		currentAlpha += (targetAlpha - currentAlpha) * ease;
		currentBlur += (targetBlur - currentBlur) * ease;

		// apply to CSS vars (blur in px)
		topNav.style.setProperty('--nav-alpha', String(currentAlpha));
		topNav.style.setProperty('--nav-blur', `${currentBlur}px`);

		// if not yet close to targets, continue animating
		if (Math.abs(currentAlpha - targetAlpha) > 0.001 || Math.abs(currentBlur - targetBlur) > 0.1) {
			rafId = requestAnimationFrame(animateNav);
		} else {
			// snap to final values and stop
			topNav.style.setProperty('--nav-alpha', String(targetAlpha));
			topNav.style.setProperty('--nav-blur', `${targetBlur}px`);
			rafId = null;
		}
	}

	// init and listen
	updateTargets();
	window.addEventListener('scroll', updateTargets, { passive: true });
	window.addEventListener('resize', updateTargets);

	// Smooth-scroll the brand link to the top of the page without navigating away.
	const brandLink = document.querySelector('.top-nav__brand');
	if (brandLink) {
		brandLink.addEventListener('click', (e) => {
			// allow modified clicks and non-left clicks to behave normally
			if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
			e.preventDefault();
			window.scrollTo({ top: 0, behavior: 'smooth' });
		});
	}

	// Remove persistent focus state for pointer clicks so links don't 'stay' active.
	// Keyboard users keep focus for accessibility (clicks from keyboard have event.detail === 0).
	const navInteractive = document.querySelectorAll('.top-nav__link, .top-nav__cta');
	if (navInteractive.length) {
		navInteractive.forEach((el) => {
			el.addEventListener('click', (ev) => {
				try {
					if (ev.detail !== 0) {
						// pointer-generated click — blur to remove focus styles
						setTimeout(() => el.blur(), 0);
					}
				} catch (e) {
					// ignore
				}
			});
		});
	}
})();
