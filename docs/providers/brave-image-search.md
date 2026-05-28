# Image Search

Search from a comprehensive index of images across the web with advanced filtering options

## Overview

Image Search provides access to a vast index of images from across the internet.
Our service continuously crawls and indexes images from various sources, enabling
you to retrieve relevant visual content for your applications with powerful
filtering and customization options.

## Key Features

Search across billions of indexed images from diverse sources worldwide

Retrieve up to 200 images per request for comprehensive coverage

Target images from specific countries and in preferred languages

Default strict filtering ensures family-friendly results

## API Reference

View the complete API reference, including endpoints, parameters, and example
  requests

## Use Cases

Image Search is perfect for:

- **Visual Content Discovery**: Build image galleries and discovery features
- **E-commerce Applications**: Find product images and visual inspiration
- **Creative Tools**: Source images for design and creative projects
- **Content Management**: Discover and aggregate visual content
- **Research and Analysis**: Gather visual data for analysis and research

## Basic Search

Get started with a simple image search request:

```bash
curl "https://api.search.brave.com/res/v1/images/search?q=mountain+landscape" \
  -H "X-Subscription-Token: <YOUR_API_KEY>"
```

## Country and Language Targeting

Customize your image search results by specifying:

- **Country**: Prefer images from specific countries using country codes (or `ALL` for worldwide)
- **Search Language**: Prefer results by content language

Example request for images from Japan in Japanese:

```bash
curl "https://api.search.brave.com/res/v1/images/search?q=桜&country=JP&search_lang=ja" \
  -H "X-Subscription-Token: <YOUR_API_KEY>"
```

## Result Count Control

Image Search supports retrieving large batches of results:

- **Default**: 50 images per request
- **Maximum**: 200 images per request
- Higher limits than other search types for comprehensive visual content discovery

Example request for 100 images:

```bash
curl "https://api.search.brave.com/res/v1/images/search?q=wildlife+photography&count=100" \
  -H "X-Subscription-Token: <YOUR_API_KEY>"
```

The actual number of images returned may be less than requested based on
  available results for the query.

## Safe Search

Image Search prioritizes safe content with strict filtering by default:

- **strict**: Drops all adult content from search results (default)
- **off**: No filtering applied (except for illegal content)

This default setting ensures that image results are appropriate for all audiences out of the box.

Example request with safe search disabled:

```bash
curl "https://api.search.brave.com/res/v1/images/search?q=art&safesearch=off" \
  -H "X-Subscription-Token: <YOUR_API_KEY>"
```

Disabling safe search may return adult or inappropriate content. Use with
  caution and only when appropriate for your use case.

## Spellcheck

Image Search includes automatic spellcheck functionality to improve search accuracy:

- Enabled by default
- Automatically corrects common misspellings
- The modified query is used for search and available in the response
- Particularly useful for visual searches where terminology matters

To disable spellcheck:

```bash
curl "https://api.search.brave.com/res/v1/images/search?q=architecure&spellcheck=false" \
  -H "X-Subscription-Token: <YOUR_API_KEY>"
```

## Example: Complete Search Request

Here's a comprehensive example combining multiple parameters:

```bash
curl "https://api.search.brave.com/res/v1/images/search?q=modern+architecture&country=US&search_lang=en&count=150&safesearch=strict" \
  -H "X-Subscription-Token: <YOUR_API_KEY>"
```

This request:

- Searches for "modern architecture"
- Targets US content
- Returns English language results
- Retrieves up to 150 images
- Applies strict safe search filtering

## Response Format

Each image result typically includes:

- Image URL and thumbnail
- Source page URL
- Image dimensions
- Title and description
- Publisher information

See the [API Reference](/api-reference/images/image_search) for complete response schema details.

## Image Proxy and Thumbnails

Each image result includes a thumbnail URL that is served through the Brave Search image proxy. The thumbnail is resized to have a width of **500 pixels** while maintaining the original aspect ratio.

### Why Brave Uses Proxied Image URLs

Brave Search uses proxied image URLs for two important reasons:

1. **Reduced load on source servers**: By caching and serving images through our proxy, we reduce the number of requests to the original image hosts.
2. **User privacy protection**: Proxied URLs prevent image source servers from tracking end users, as all requests originate from Brave's infrastructure rather than user devices.

### Properties Field

The `properties` field in each image result contains additional URL information:

- **url**: The original image URL from the source website
- **placeholder**: A small placeholder URL, also served through the Brave Search image proxy
- Properties often include `width` and `height` values, though these are not always available 

This allows you to choose between the standard 500px thumbnail in the main response or access the original source URL when needed.

## Best Practices

### Query Optimization

- Use descriptive, specific terms for better results
- Combine multiple keywords to narrow down results
- Consider language and regional variations in terminology

### Performance

- Request only the number of images you need
- Use appropriate country and language filters to reduce noise
- Implement caching on your end to minimize API calls

### Content Safety

- Keep strict safe search enabled for public-facing applications
- Implement additional content moderation if needed for your specific use case
- Be aware of copyright and licensing when using discovered images

## Changelog

This changelog outlines all significant changes to the Brave Image Search API in chronological order.

- **2023-05-10** Add Brave Image Search API resource.
- **2024-01-20** Increase maximum result count to 200 images.
- **2024-08-15** Improve spellcheck accuracy for visual search terms.