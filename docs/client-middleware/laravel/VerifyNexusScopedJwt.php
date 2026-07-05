<?php
/**
 * Nexus Widget — scoped JWT verification middleware for Laravel.
 * Register in bootstrap/app.php or Http/Kernel.php.
 *
 * Expects: Authorization: Bearer <token>
 *          X-Nexus-Operation-Id: <operation_id> (must match token claim)
 */
namespace App\Http\Middleware;

use Closure;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\Request;

class VerifyNexusScopedJwt
{
    public function handle(Request $request, Closure $next)
    {
        $auth = $request->header('Authorization', '');
        if (!str_starts_with($auth, 'Bearer ')) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $token = substr($auth, 7);
        $secret = config('services.nexus.jwt_signing_secret');

        try {
            $payload = JWT::decode($token, new Key($secret, 'HS256'));
        } catch (\Exception $e) {
            return response()->json(['error' => 'Invalid token'], 401);
        }

        if (($payload->iss ?? '') !== 'nexus-widget') {
            return response()->json(['error' => 'Invalid issuer'], 401);
        }

        $operationId = $request->header('X-Nexus-Operation-Id');
        $allowed = $payload->allowed_operation_ids ?? [];

        if (!$operationId || !in_array($operationId, $allowed, true)) {
            return response()->json(['error' => 'Operation not permitted'], 403);
        }

        $request->attributes->set('nexus', [
            'site_id' => $payload->site_id ?? null,
            'visitor_id' => $payload->visitor_id ?? null,
        ]);

        return $next($request);
    }
}
