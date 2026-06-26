/**
 * Cloudflare Worker — maps-resolver
 * يفك روابط Google Maps المختصرة ويستخرج الإحداثيات
 * الرابط: https://maps-resolver.YOUR-NAME.workers.dev/resolve?url=...
 */

export default {
  async fetch(request) {

    // ── CORS: اسمح للتطبيق بالاتصال ──
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const { searchParams } = new URL(request.url);
    const mapUrl = searchParams.get('url');

    if (!mapUrl) {
      return new Response(
        JSON.stringify({ error: 'يُرجى إرسال رابط عبر ?url=' }),
        { status: 400, headers: corsHeaders }
      );
    }

    try {
      // ── الخطوة 1: فك الرابط المختصر بمتابعة إعادة التوجيه ──
      const response = await fetch(mapUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      const finalUrl = response.url;
      const html     = await response.text();

      // ── الخطوة 2: البحث عن الإحداثيات بأنماط متعددة ──
      const patterns = [
        /@(-?\d+\.\d+),(-?\d+\.\d+)/,
        /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
        /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
        /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
        /center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/,
        /"(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})"/,
      ];

      let lat = null, lng = null;

      // ابحث في الـ URL النهائي أولاً
      for (const pat of patterns) {
        const m = finalUrl.match(pat);
        if (m && isValidCoords(+m[1], +m[2])) {
          lat = +m[1]; lng = +m[2]; break;
        }
      }

      // ثم في الـ HTML
      if (!lat) {
        for (const pat of patterns) {
          const m = html.match(pat);
          if (m && isValidCoords(+m[1], +m[2])) {
            lat = +m[1]; lng = +m[2]; break;
          }
        }
      }

      // ── الخطوة 3: استخراج اسم المكان ──
      let placeName = '';
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      if (titleMatch) {
        placeName = titleMatch[1].replace(' - Google Maps', '').replace(' – خرائط Google', '').trim();
      }
      if (!placeName) {
        const placeMatch = finalUrl.match(/maps\/place\/([^/@?&]+)/);
        if (placeMatch) placeName = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
      }

      if (lat && lng) {
        return new Response(JSON.stringify({
          success: true,
          lat, lng,
          placeName,
          finalUrl,
        }), { headers: corsHeaders });
      }

      // لم نجد إحداثيات
      return new Response(JSON.stringify({
        success: false,
        finalUrl,
        placeName,
        error: 'لم يتم العثور على إحداثيات في الرابط',
      }), { headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({
        success: false,
        error: err.message,
      }), { status: 500, headers: corsHeaders });
    }
  }
};

function isValidCoords(lat, lng) {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
      && !(lat === 0 && lng === 0);
}
