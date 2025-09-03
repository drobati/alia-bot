# /horoscope Command - Design Specification

## Overview
Comprehensive horoscope command system providing personalized astrological guidance for Discord users. Designed for high engagement with premium UX and extensive customization options.

## Command Structure
```
/horoscope [sign] [type] [period] [public]
```

### Parameters
- **sign** (optional): Zodiac sign or birth date (MM-DD format)
- **type** (optional): Horoscope category 
  - `daily` - Today's guidance (default)
  - `love` - Romance & relationships
  - `career` - Professional insights  
  - `lucky` - Numbers, colors & timing
  - `weekly` - Week-long forecast
  - `monthly` - Month overview
- **period** (optional): Time frame
  - `today` - Current day (default)
  - `tomorrow` - Next day
  - `this-week` - Current week
  - `next-week` - Upcoming week
  - `this-month` - Current month
- **public** (optional): Share publicly (default: private/ephemeral)

## Technical Architecture

### Core Components
1. **Main Command Handler** (`src/commands/horoscope.ts`)
2. **Zodiac Utility System** (`src/utils/zodiacUtil.ts`) 
3. **Content Generation Engine** (`src/utils/horoscopeGenerator.ts`)
4. **Database Models** (`src/models/horoscopeUser.ts`, `src/models/horoscopeCache.ts`)
5. **Comprehensive Test Suite** (42+ tests across multiple files)

### Database Schema

#### HoroscopeUser Table
```sql
- id: BIGINT PRIMARY KEY
- userId: VARCHAR(255) UNIQUE (Discord user ID)
- preferredSign: VARCHAR(20)
- preferredType: VARCHAR(20) DEFAULT 'daily'
- birthMonth: TINYINT
- birthDay: TINYINT
- totalReadings: INTEGER DEFAULT 0
- lastReading: TIMESTAMP
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP
```

#### HoroscopeCache Table
```sql
- id: BIGINT PRIMARY KEY
- cacheKey: VARCHAR(255) UNIQUE
- content: TEXT
- expiresAt: TIMESTAMP
- createdAt: TIMESTAMP
```

### Zodiac System Features

#### Complete Sign Data
- **12 Zodiac Signs** with full metadata
- **Elements**: Fire, Earth, Air, Water
- **Ruling Planets**: Mars, Venus, Mercury, etc.
- **Personality Traits**: For content personalization
- **Compatibility Matrix**: For relationship insights
- **Date Ranges**: Accurate astronomical dates

#### Smart Detection
- **Birth Date Parsing**: "03-21" → Aries
- **Fuzzy Name Matching**: "ari" → Aries, "scorp" → Scorpio
- **Year-Crossing Logic**: Handles Capricorn/Sagittarius boundary
- **Validation**: Input sanitization and error handling

### Content Generation

#### Template System
- **200+ Content Templates** across categories
- **Dynamic Personalization** using zodiac traits
- **Variability Engine** prevents repetitive content
- **Context-Aware Generation** based on type/period combinations

#### Lucky Elements
- **Lucky Numbers**: 5 unique sorted numbers (1-99)
- **Lucky Colors**: Coordinated with zodiac themes
- **Cosmic Moods**: Themed emotional states
- **Element Integration**: Fire/Earth/Air/Water influence

### Caching Strategy
- **Daily Readings**: Cached until midnight
- **Weekly Readings**: Cached until week end  
- **Monthly Readings**: Cached until month end
- **Cache Keys**: `{sign}_{type}_{period}_{date}`
- **Automatic Expiration**: Background cleanup process

## User Experience Design

### Visual Design System

#### Zodiac Color Palette
- **Fire Signs**: Warm reds, oranges, purples (Aries #E74C3C, Leo #F39C12, Sagittarius #9B59B6)
- **Earth Signs**: Natural greens, browns, navy (Taurus #27AE60, Virgo #8B4513, Capricorn #2C3E50)
- **Air Signs**: Bright yellows, pinks, cyans (Gemini #F1C40F, Libra #E91E63, Aquarius #00BCD4)
- **Water Signs**: Deep silvers, crimsons, purples (Cancer #95A5A6, Scorpio #8B0000, Pisces #6A0DAD)

#### Embed Layout Structure
```
┌─────────────────────────────────────┐
│ ✨ [SIGN EMOJI] [SIGN NAME] [TYPE]   │ ← Title
├─────────────────────────────────────┤
│ 🔮 [PERIOD] • [DATE RANGE]          │ ← Context
├─────────────────────────────────────┤
│ [MAIN HOROSCOPE CONTENT]            │ ← Body
│                                     │
│ 💫 **Lucky Numbers:** [NUMBERS]    │ ← Structured
│ 🌟 **Mood:** [MOOD_EMOJI] [MOOD]   │   Data
│ 🎨 **Lucky Color:** [COLOR_DOT]    │   Fields
├─────────────────────────────────────┤
│ [THUMBNAIL: Sign Symbol]            │ ← Visual
└─────────────────────────────────────┘
```

#### Typography Hierarchy
- **Title**: `**✨ ♈ ARIES • Daily Horoscope**` (Bold + Emojis + Symbols)
- **Subtitle**: `🔮 Today • January 15, 2025` (Context + Date)
- **Body**: Clean paragraphs, 2-3 sentences max, mobile-optimized
- **Data Fields**: `💫 **Lucky Numbers:** 7, 14, 23` (Bold keys, clean values)

### User Flow Design

#### Progressive Disclosure
1. **Level 1**: `/horoscope aries` → Simple daily reading
2. **Level 2**: `/horoscope aries love weekly` → Advanced customization  
3. **Level 3**: Preference persistence after 3+ uses

#### First-Time User Experience
- **Welcome Screen**: Shows all zodiac signs with examples
- **Educational Content**: Explains different horoscope types
- **Guided Usage**: Example commands and tips
- **Preference Learning**: Suggests saving commonly used combinations

#### Autocomplete Design
- **Smart Suggestions**: Type "a" → Shows "♒ Aquarius", "♈ Aries"
- **Date Recognition**: "03-21" → "03-21 → ♈ Aries (Mar 21 - Apr 19)"
- **Fuzzy Matching**: "cap" → "♑ Capricorn"
- **Context Hints**: "daily" → "📅 Daily • Get today's guidance"

### Error Handling & States

#### Error State Examples
- **Unknown Sign**: Helpful guide showing all valid signs
- **API Errors**: Mystical-themed error messages ("cosmic energy is hazy")
- **Rate Limits**: Gentle delay messages with cosmic theming

#### Success States
- **Preference Saved**: "💾 Cosmic preferences saved!"
- **First Reading**: "🎉 Welcome to your cosmic journey!"
- **Usage Tips**: Contextual helpful suggestions

## Analytics & Tracking

### Usage Metrics
- **Command Usage**: `command_usage_horoscope`
- **Type-Specific**: `horoscope_type_{type}` counters
- **User Preferences**: Most popular signs and types
- **Engagement Patterns**: Reading frequency and retention

### Performance Monitoring
- **Cache Hit Rates**: Measure caching effectiveness
- **Response Times**: API and database query performance
- **Error Rates**: Track failure modes and recovery
- **User Satisfaction**: Implicit engagement metrics

## Implementation Status

### Completed Components
✅ **Technical Architecture**: Full system design
✅ **Database Schema**: User preferences and caching tables  
✅ **Content Strategy**: 200+ templates and generation logic
✅ **Visual Design**: Complete embed layouts and color system
✅ **User Experience**: Progressive disclosure and onboarding flows
✅ **Test Strategy**: 42 comprehensive tests planned

### Implementation Files
- `src/commands/horoscope.ts` - Main command implementation
- `src/commands/horoscope.test.ts` - Command tests (25 tests)
- `src/utils/zodiacUtil.ts` - Zodiac data and utilities  
- `src/utils/zodiacUtil.test.ts` - Zodiac utility tests (13 tests)
- `src/utils/horoscopeGenerator.ts` - Content generation engine
- `src/utils/horoscopeGenerator.test.ts` - Generator tests (19 tests)
- `src/models/horoscopeUser.ts` - User preferences model
- `src/models/horoscopeCache.ts` - Caching model
- `migrations/20250103000000-create-horoscope-tables.js` - Database setup

### Ready for Development
The comprehensive design is ready for immediate implementation following established patterns from successful commands like `/stats` and `/fortune`. All technical specifications, user experience flows, and implementation details are fully documented and ready for execution.

## Future Enhancements

### Potential Extensions
- **Birth Time Integration**: More precise astrological calculations
- **Location Awareness**: Timezone and geographical considerations
- **Social Features**: Horoscope sharing and compatibility matching
- **API Integrations**: Professional astrology data sources
- **Advanced Personalization**: Machine learning for content preferences
- **Cross-Command Integration**: Connect with other bot features

This design creates a premium, engaging horoscope experience that will delight users and encourage regular usage while maintaining the high quality standards of the alia-bot ecosystem.