# Via

Via is an AI-assisted global flight planner. Travelers describe a one-way trip in natural language, then compare live nonstop, connecting, and separately ticketed multi-city routes by price, personal interest, and directness.

## Live demo

[Open Via](https://via-flight-planner-demo.xachaix.chatgpt.site)

## What Via does

- Understands cities, regions, dates, cabin class, passenger count, and airline preferences through conversation
- Searches live Google Flights results through SerpApi and groups comparable itineraries
- Suggests geographically relevant stopover cities for optional multi-city exploration
- Learns durable travel preferences and applies them transparently across every route
- Builds source-grounded stopover recommendations around real flight and layover times
- Supports English, Simplified Chinese, Japanese, and Korean across 7,066 airport records

## Technical overview

Via is built with Next.js, React, TypeScript, Vinext, Cloudflare Workers, and D1. Server-side AI providers handle conversational search, preference evaluation, and itinerary planning, while live web search grounds stopover recommendations.

## Current scope

Via is a working MVP focused on one-way flight discovery and stopover planning. Live fares and schedules may change, and separately ticketed segments require independent booking and schedule verification.
