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
}
