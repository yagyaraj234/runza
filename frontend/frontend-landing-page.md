{
"meta": {
"purpose": "Landing page hero + feature section for a CI/PR test automation tool (Playwright test generation, video recording, GCS+CDN upload, failure links)",
"reference_layout": "single-column centered hero, feature cards row, social proof strip, testimonial avatar row, alternating content sections below",
"assumption_note": "No brand colors supplied. Defaulted to dark dev-tool palette. Replace color values if a brand kit exists."
},
"canvas": {
"width": 1440,
"height": 3200,
"background_color": "#0B0D10",
"background_texture": "subtle 2% opacity diagonal grid or dot-grid pattern, like a terminal/IDE background"
},
"top_nav": {
"background": "transparent, blends into hero background",
"items": ["Pricing", "Docs", "Get Access"],
"text_color": "#C9CED6",
"cta_button": {
"label": "Get Access",
"background": "#39FF88",
"text_color": "#06110A",
"border_radius": 24,
"font_weight": 600
},
"back_arrow_color": "#C9CED6"
},
"hero_section": {
"glow_orb": {
"shape": "radial gradient circle, soft blurred edges",
"position": "top center, partially clipped by viewport top",
"size": 140,
"gradient_stops": [
{ "position": "0%", "color": "#39FF88", "opacity": 0.9 },
{ "position": "60%", "color": "#1FA6FF", "opacity": 0.5 },
{ "position": "100%", "color": "#0B0D10", "opacity": 0 }
],
"blur_px": 40
},
"headline": {
"line_1": "Ship tests",
"line_2_italic": "not bugs.",
"font_family": "serif, e.g. 'Playfair Display' or 'Georgia', italic on second line only",
"font_size": 56,
"color": "#F4F6F8",
"letter_spacing": -0.5,
"line_height": 1.1
},
"subheadline": {
"text": "Ready to stop writing Playwright tests by hand?",
"font_family": "sans-serif, e.g. 'Inter'",
"font_size": 16,
"color": "#8A929E",
"letter_spacing": 1,
"text_transform": "none"
},
"cta_button": {
"label": "Request Access",
"icon": "small arrow or lightning glyph",
"background": "#39FF88",
"text_color": "#06110A",
"border_radius": 28,
"padding": "14px 32px",
"font_weight": 600,
"shadow": "0 0 24px rgba(57,255,136,0.35)"
},
"microcopy_below_cta": {
"text": "FREE FOREVER. NO CREDIT CARD REQUIRED.",
"font_size": 11,
"letter_spacing": 2,
"color": "#5A6270",
"text_transform": "uppercase"
}
},
"feature_cards_row": {
"layout": "3 overlapping cards, slight rotation, staggered vertical offset",
"cards": [
{
"title": "PR Test Autopilot",
"background_gradient": ["#1A1F26", "#232B34"],
"accent_color": "#39FF88",
"description": "Auto-generates Playwright test cases for every open PR.",
"illustration": "small terminal window icon with green checkmark"
},
{
"title": "Video Evidence Engine",
"background_gradient": ["#22262C", "#2B3038"],
"accent_color": "#1FA6FF",
"description": "Records every run, uploads to GCS behind a CDN.",
"illustration": "small play-button/video-frame icon"
},
{
"title": "Failure Digest",
"background_gradient": ["#26202A", "#332633"],
"accent_color": "#FF4C61",
"description": "One link per PR showing exactly what broke.",
"illustration": "small red X / alert icon"
}
],
"card_border_radius": 20,
"card_shadow": "0 12px 40px rgba(0,0,0,0.45)"
},
"social_proof_strip": {
"label": "Trusted by teams shipping fast",
"label_color": "#5A6270",
"logo_treatment": "grayscale, 40% opacity, monochrome white/gray logos",
"logo_row_background": "transparent"
},
"testimonial_avatars": {
"layout": "horizontal row, rounded rectangle chips",
"chip_background_variants": ["#152A20", "#221826", "#26210F", "#0F1F2A"],
"avatar_border_radius": 8,
"name_color": "#F4F6F8",
"role_color": "#8A929E"
},
"content_section_1": {
"eyebrow_label": {
"text": "TEST GENERATION",
"color": "#39FF88",
"letter_spacing": 2,
"font_size": 11
},
"headline": {
"text": "Tests that actually cover your PR.",
"font_family": "serif",
"font_size": 34,
"color": "#F4F6F8"
},
"background": "#12151A",
"feature_list_items": [
{ "icon_bg": "#1A2E22", "icon_color": "#39FF88", "text": "Turn a diff into a full Playwright test file" },
{ "icon_bg": "#122430", "icon_color": "#1FA6FF", "text": "Turn a flaky test into a stable one automatically" },
{ "icon_bg": "#2A1A20", "icon_color": "#FF4C61", "text": "Turn a failed run into a shareable video link" }
],
"side_image": {
"treatment": "duotone, dark navy to electric blue",
"subject": "close-up of code editor or terminal on screen, hands typing"
}
},
"color_grading_notes": {
"overall_mood": "dark mode, high contrast, single saturated accent per state (green=pass, red=fail, blue=info)",
"background_luminance": "very low, near-black with slight blue undertone (#0B0D10)",
"text_contrast": "off-white primary text (#F4F6F8), muted gray secondary text (#8A929E)",
"accent_saturation": "high, near-neon, used sparingly as single highlights not fills",
"gradient_usage": "restricted to glow orb and card backgrounds, always dark-to-dark with a hue shift, never light pastel",
"avoid": "pastel purples/pinks/creams from the reference image, cursive/whimsical illustration style, warm cozy tone"
},
"typography_system": {
"display_serif": "Playfair Display or similar, used only for headlines, italic for emphasis words",
"body_sans": "Inter or similar, used for all body copy, labels, buttons",
"monospace_accent": "JetBrains Mono, used for code snippets, PR numbers, test names, small UI chips"
}
}
