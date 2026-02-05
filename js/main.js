const heroLogoWrap = document.querySelector('.hero__logo-wrap');
const heroLogoTop = document.querySelector('.hero__logo-top');

if (heroLogoWrap && heroLogoTop) {
	let targetX = 0;
	let targetY = 0;
	let currentX = 0;
	let currentY = 0;
	let isHovering = false;
	let rafId = null;
	let initialized = false;

	const setCenterTarget = () => {
		const rect = heroLogoWrap.getBoundingClientRect();
		targetX = rect.width / 2;
		targetY = rect.height / 2;
		// set CSS vars in pixels to avoid percent -> px snapping
		heroLogoWrap.style.setProperty('--reveal-x', `${targetX}px`);
		heroLogoWrap.style.setProperty('--reveal-y', `${targetY}px`);
		if (!initialized) {
			currentX = targetX;
			currentY = targetY;
			initialized = true;
		}
	};

	const updateTargetPosition = (event) => {
		const rect = heroLogoWrap.getBoundingClientRect();
		targetX = event.clientX - rect.left;
		targetY = event.clientY - rect.top;
	};

	const tick = () => {
		const lerpFactor = 0.22; // slightly faster
		currentX += (targetX - currentX) * lerpFactor;
		currentY += (targetY - currentY) * lerpFactor;

		heroLogoWrap.style.setProperty('--reveal-x', `${currentX}px`);
		heroLogoWrap.style.setProperty('--reveal-y', `${currentY}px`);

		const distance = Math.hypot(targetX - currentX, targetY - currentY);
		if (!isHovering && distance < 0.6) {
			rafId = null;
			return;
		}

		rafId = requestAnimationFrame(tick);
	};

	const startAnimation = () => {
		if (rafId === null) {
			rafId = requestAnimationFrame(tick);
		}
	};

	// initialize to center in px so there is no perceptible snap
	setCenterTarget();
	window.addEventListener('resize', setCenterTarget);

	heroLogoTop.addEventListener('pointermove', (event) => {
		updateTargetPosition(event);
		startAnimation();
	});

	heroLogoTop.addEventListener('pointerenter', (event) => {
		isHovering = true;
		// update target immediately, but don't overwrite current to avoid snap
		updateTargetPosition(event);
		// place the current position at the pointer immediately to avoid a
		// visible snap from center -> cursor. Subsequent movement will lerp.
		currentX = targetX;
		currentY = targetY;
		heroLogoWrap.style.setProperty('--reveal-x', `${currentX}px`);
		heroLogoWrap.style.setProperty('--reveal-y', `${currentY}px`);
		startAnimation();
	});

	heroLogoTop.addEventListener('pointerleave', () => {
		isHovering = false;
		setCenterTarget();
		startAnimation();
	});

	const hero = document.querySelector('.hero');

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    // Moves background down slightly as you scroll
    hero.style.backgroundPosition = `center ${scrollY * 0.3}px`;
    // 0.05 = extremely subtle; tweak between 0.03–0.08
  });
}

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
})();
