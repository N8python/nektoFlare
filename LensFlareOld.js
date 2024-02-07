import * as THREE from 'three';
import { Pass } from "postprocessing";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";

class Flare {
    constructor({
        enabled = true,
        position = new THREE.Vector3(0, 20, 0),
        opacity = 0.8,
        colorGain = new THREE.Color(1.0, 0.1, 0.1),
        starPoints = 5.0,
        glareSize = 0.55,
        flareSize = 0.004,
        flareSpeed = 0.4,
        flareShape = 1.2,
        haloScale = 0.5,
        animated = true,
        anamorphic = false,
        secondaryGhosts = true,
        starBurst = true,
        ghostScale = 0.3,
        additionalStreaks = true,
        followMouse = false
    } = {}) {
        this.enabled = enabled;
        this.position = position;
        this.lensPosition = new THREE.Vector3(0.5, 0.5, 0.5);
        this.opacity = opacity;
        this.colorGain = colorGain;
        this.starPoints = starPoints;
        this.glareSize = glareSize;
        this.flareSize = flareSize;
        this.flareSpeed = flareSpeed;
        this.flareShape = flareShape;
        this.haloScale = haloScale;
        this.animated = animated;
        this.anamorphic = anamorphic;
        this.secondaryGhosts = secondaryGhosts;
        this.starBurst = starBurst;
        this.ghostScale = ghostScale;
        this.additionalStreaks = additionalStreaks;
        this.followMouse = followMouse;
    }
    project(camera) {
        this.lensPosition = this.position.clone().project(camera).multiplyScalar(0.5).addScalar(0.5);
    }
}
class LensFlarePass extends Pass {
    constructor(camera) {
        super();
        this.width = 1;
        this.height = 1;
        this.camera = camera;
        this.flareRenderTarget = new THREE.WebGLRenderTarget(this.width / 2, this.height / 2, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType
        });
        this.coverageTarget = new THREE.WebGLRenderTarget(32, 32, {
            type: THREE.HalfFloatType,
            minFilter: THREE.LinearMipMapLinearFilter,
            magFilter: THREE.LinearFilter,
            generateMipmaps: true,
            depth: false,

        })
        this.outputQuad = new FullScreenQuad(new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                flareDiffuse: { value: this.flareRenderTarget.texture },
                texelSize: { value: new THREE.Vector4(0, 0, 0, 0) }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: /*glsl*/ `
                uniform sampler2D tDiffuse;
                uniform sampler2D flareDiffuse;
                uniform vec4 texelSize;
                varying vec2 vUv;
                float w0(float a)
{
    return (1.0/6.0)*(a*(a*(-a + 3.0) - 3.0) + 1.0);
}

float w1(float a)
{
    return (1.0/6.0)*(a*a*(3.0*a - 6.0) + 4.0);
}

float w2(float a)
{
    return (1.0/6.0)*(a*(a*(-3.0*a + 3.0) + 3.0) + 1.0);
}

float w3(float a)
{
    return (1.0/6.0)*(a*a*a);
}

// g0 and g1 are the two amplitude functions
float g0(float a)
{
    return w0(a) + w1(a);
}

float g1(float a)
{
    return w2(a) + w3(a);
}

// h0 and h1 are the two offset functions
float h0(float a)
{
    return -1.0 + w1(a) / (w0(a) + w1(a));
}

float h1(float a)
{
    return 1.0 + w3(a) / (w2(a) + w3(a));
}

vec4 texture_bicubic(sampler2D tex, vec2 uv, vec4 texelSize)
{
	uv = uv*texelSize.zw + 0.5;
	vec2 iuv = floor( uv );
	vec2 fuv = fract( uv );

    float g0x = g0(fuv.x);
    float g1x = g1(fuv.x);
    float h0x = h0(fuv.x);
    float h1x = h1(fuv.x);
    float h0y = h0(fuv.y);
    float h1y = h1(fuv.y);

	vec2 p0 = (vec2(iuv.x + h0x, iuv.y + h0y) - 0.5) * texelSize.xy;
	vec2 p1 = (vec2(iuv.x + h1x, iuv.y + h0y) - 0.5) * texelSize.xy;
	vec2 p2 = (vec2(iuv.x + h0x, iuv.y + h1y) - 0.5) * texelSize.xy;
	vec2 p3 = (vec2(iuv.x + h1x, iuv.y + h1y) - 0.5) * texelSize.xy;
	
    return g0(fuv.y) * (g0x * texture(tex, p0)  +
                        g1x * texture(tex, p1)) +
           g1(fuv.y) * (g0x * texture(tex, p2)  +
                        g1x * texture(tex, p3));
}
                void main() {
                    gl_FragColor = texture2D(tDiffuse, vUv) + ( texture_bicubic(flareDiffuse, vUv, texelSize));
                }
            `
        }));

        this.needsDepthTexture = true;
        this.needsSwap = true;
        this.flares = []; //new Flare();
        for (let i = 0; i < 128; i++) {
            const flare = new Flare({
                position: new THREE.Vector3(Math.random() * 100 - 50, Math.random() * 20, Math.random() * 20 - 10),
                colorGain: new THREE.Color(Math.random(), Math.random(), Math.random())
            });
            this.flares.push(flare);
        }
        this.coverageQuad = new FullScreenQuad(new THREE.ShaderMaterial({
            uniforms: {
                depthTexture: { value: null },
                coverageRadius: { value: 1.0 },
                lensPosition: { value: new THREE.Vector3(0.5, 0.5, 0.5) }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: /*glsl*/ `
                uniform sampler2D depthTexture;
                uniform float coverageRadius;
                uniform vec3 lensPosition;
                varying vec2 vUv;
                float rand(vec2 n) { 
                    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
                  }
                void main() {
                    vec4 occluded = vec4(0.0);
                    vec2 sampleOffset = sqrt(rand(gl_FragCoord.xy)) * vec2(cos(rand(gl_FragCoord.xy + 1000.0) * 6.28319), sin(rand(gl_FragCoord.xy + 1000.0) * 6.28319));
                    vec2 sampleUv = lensPosition.xy + coverageRadius * sampleOffset;
                    if (texture2D(depthTexture, sampleUv).r < lensPosition.z || (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0)) {
                        occluded = vec4(1.0);
                    }          
                    gl_FragColor = occluded;
                }
            `,
            depthTest: false,
            depthWrite: false


        }));

        this.flareQuad = new FullScreenQuad(new THREE.ShaderMaterial({
            uniforms: {
                flare: {
                    value: this.flare
                },
                coverageTexture: {
                    value: this.coverageTarget.texture
                },
                depthTexture: {
                    value: this.depthTexture
                },
                lensPosition: {
                    value: new THREE.Vector3(0.5, 0.5, 0.5)
                },
                resolution: {
                    value: new THREE.Vector2(0, 0)
                },
                cameraPos: {
                    value: new THREE.Vector3(0, 0, 0)
                },
                cameraDirection: {
                    value: new THREE.Vector3(0, 0, 0)
                }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: /*glsl*/ `
            struct Flare {
                bool enabled;
                vec3 lensPosition;
                vec3 position;
                float opacity;
                vec3 colorGain;
                float starPoints;
                float glareSize;
                float flareSize;
                float flareSpeed;
                float flareShape;
                float haloScale;
                bool animated;
                bool anamorphic;
                bool secondaryGhosts;
                bool starBurst;
                float ghostScale;
                bool additionalStreaks;
                bool followMouse;
            };
            uniform Flare flare;
            uniform vec2 resolution;
            uniform vec3 lensPosition;
            uniform vec3 cameraPos;
            uniform vec3 cameraDirection;
            varying vec2 vUv;
            uniform sampler2D coverageTexture;
            uniform sampler2D depthTexture;

            float uDispersal = 0.3;
            float uHaloWidth = 0.6;
            float uDistortion = 1.5;
            float uBrightDark = 0.5;
            vec2 vTexCoord;
            
        
            float rand(float n){return fract(sin(n) * 43758.5453123);}
        
            float noise(float p){
                float fl = floor(p);
                float fc = fract(p);
                return mix(rand(fl),rand(fl + 1.0), fc);
            }
        
            vec3 hsv2rgb(vec3 c)
            {
                vec4 k = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                vec3 p = abs(fract(c.xxx + k.xyz) * 6.0 - k.www);
                return c.z * mix(k.xxx, clamp(p - k.xxx, 0.0, 1.0), c.y);
            }
        
            float saturate2(float x)
            {
                return clamp(x, 0.,1.);
            }
        
        
            vec2 rotateUV(vec2 uv, float rotation)
            {
                return vec2(
                    cos(rotation) * uv.x + sin(rotation) * uv.y,
                    cos(rotation) * uv.y - sin(rotation) * uv.x
                );
            }
        
            // Based on https://www.shadertoy.com/view/XtKfRV
            vec3 drawflare(Flare flare, vec2 p, float intensity, float rnd, float speed, int id)
            {
                float flarehueoffset = (1. / 32.) * float(id) * 0.1;
                float lingrad = distance(vec2(0.), p);
                float expgrad = 1. / exp(lingrad * (fract(rnd) * 0.66 + 0.33));
                vec3 colgrad = hsv2rgb(vec3( fract( (expgrad * 8.) + speed * flare.flareSpeed + flarehueoffset), pow(1.-abs(expgrad*2.-1.), 0.45), 20.0 * expgrad * intensity)); //rainbow spectrum effect
        
                float internalStarPoints;
        
                if(flare.anamorphic){
                    internalStarPoints = 1.0;
                } else{
                    internalStarPoints = flare.starPoints;
                }
                
                float blades = length(p * flare.flareShape * sin(internalStarPoints * atan(p.x, p.y))); //draw 6 blades
                
                float comp = pow(1.-saturate2(blades), ( flare.anamorphic ? 100. : 12.));
                comp += saturate2(expgrad-0.9) * 3.;
                comp = pow(comp * expgrad, 8. + (1.-intensity) * 5.);
                
                if(flare.flareSpeed > 0.0){
                    return vec3(comp) * colgrad;
                } else{
                    return vec3(comp) * flare.flareSize * 15.;
                }
            }
        
            float dist(vec3 a, vec3 b) { return abs(a.x - b.x) + abs(a.y - b.y) + abs(a.z - b.z); }
        
            float glare(Flare flare, vec2 uv, vec2 pos, float size)
            {
                vec2 main;
        
             
                main = uv-pos;     
                
                float ang = atan(main.y, main.x) * (flare.anamorphic ? 1.0 : flare.starPoints);
                float dist = length(main); 
                dist = pow(dist, .9);
                
                float f0 = 1.0/(length(uv-pos)*(1.0/size*16.0)+.2);
        
                return f0+f0*(sin((ang))*.2 +.3);
            }
        
            //https://www.shadertoy.com/view/Xd2GR3
            float sdHex(vec2 p){
                p = abs(p);
                vec2 q = vec2(p.x*2.0*0.5773503, p.y + p.x*0.5773503);
                return dot(step(q.xy,q.yx), 1.0-q.yx);
            }
        
            //fakes x^n for specular effects (k is 0-1)
            float fpow(float x, float k){
                return x > k ? pow((x-k)/(1.0-k),2.0) : 0.0;
            }
        
            vec3 renderhex(Flare flare, vec2 uv, vec2 p, float s, vec3 col){
                uv -= p;
                if (abs(uv.x) < 0.2*s && abs(uv.y) < 0.2*s){
                    return mix(vec3(0),mix(vec3(0),col,0.1 + fpow(length(uv/s),0.1)*10.0),smoothstep(0.0,0.1,sdHex(uv*20.0/s)));
                }
                return vec3(0);
            }
        
            vec3 LensFlare(Flare flare, vec2 uv, vec2 pos)
            {
                vec2 main = uv-pos;
                vec2 uvd = uv*(length(uv));
                
                float ang = atan(main.x,main.y);
                
                float f0 = .3/(length(uv-pos)*16.0+1.0);
                
                f0 = f0*(sin(noise(sin(ang*3.9) * flare.starPoints))*.2 );
                
                float f1 = max(0.01-pow(length(uv+1.2*pos),1.9),.0)*7.0;
        
                float f2 = max(.9/(10.0+32.0*pow(length(uvd+0.99*pos),2.0)),.0)*0.35;
                float f22 = max(.9/(11.0+32.0*pow(length(uvd+0.85*pos),2.0)),.0)*0.23;
                float f23 = max(.9/(12.0+32.0*pow(length(uvd+0.95*pos),2.0)),.0)*0.6;
                
                vec2 uvx = mix(uv,uvd, 0.1);
                
                float f4 = max(0.01-pow(length(uvx+0.4*pos),2.9),.0)*4.02;
                float f42 = max(0.0-pow(length(uvx+0.45*pos),2.9),.0)*4.1;
                float f43 = max(0.01-pow(length(uvx+0.5*pos),2.9),.0)*4.6;
                
                uvx = mix(uv,uvd,-.4);
                
                float f5 = max(0.01-pow(length(uvx+0.1*pos),5.5),.0)*2.0;
                float f52 = max(0.01-pow(length(uvx+0.2*pos),5.5),.0)*2.0;
                float f53 = max(0.01-pow(length(uvx+0.1*pos),5.5),.0)*2.0;
                
                uvx = mix(uv,uvd, 2.1);
                
                float f6 = max(0.01-pow(length(uvx-0.3*pos),1.61),.0)*3.159;
                float f62 = max(0.01-pow(length(uvx-0.325*pos),1.614),.0)*3.14;
                float f63 = max(0.01-pow(length(uvx-0.389*pos),1.623),.0)*3.12;
                
                vec3 c = vec3(glare(flare, uv,pos, flare.glareSize));
        
                vec2 prot;
        
               if(flare.anamorphic){
                    prot = rotateUV(uv - pos, 1.570796);     
                } else {
                    prot = uv - pos;
                }
        
                c += drawflare(flare, prot, (flare.anamorphic ? flare.flareSize * 10. : flare.flareSize), 0.1, 0.0, 1);
                
                c.r+=f1+f2+f4+f5+f6; c.g+=f1+f22+f42+f52+f62; c.b+=f1+f23+f43+f53+f63;
                c = c*1.3 * vec3(length(uvd)+.09); // Vignette
                c+=vec3(f0);
                
                return c;
            }
        
            vec3 cc(vec3 color, float factor,float factor2)
            {
                float w = color.x+color.y+color.z;
                return mix(color,vec3(w)*factor,w*factor2);
            }    
        
            float rnd(vec2 p)
            {
                float f = fract(sin(dot(p, vec2(12.1234, 72.8392) )*45123.2));
                return f;   
            }
        
            float rnd(float w)
            {
                float f = fract(sin(w)*1000.);
                return f;   
            }
        
            float regShape(vec2 p, int N)
            {
                float f;
                
                float a=atan(p.x,p.y)+.2;
                float b=6.28319/float(N);
                f=smoothstep(.5,.51, cos(floor(.5+a/b)*b-a)*length(p.xy)* 2.0  -flare.ghostScale);
                    
                return f;
            }
        
            // Based on https://www.shadertoy.com/view/Xlc3D2
            vec3 circle(Flare flare, vec2 p, float size, float decay, vec3 color, vec3 color2, float dist, vec2 mouse)
            {
                float l = length(p + mouse*(dist*2.))+size/2.;
                float l2 = length(p + mouse*(dist*4.))+size/3.;
                
                float c = max(0.04-pow(length(p + mouse*dist), size*flare.ghostScale), 0.0)*10.;
                float c1 = max(0.001-pow(l-0.3, 1./40.)+sin(l*20.), 0.0)*3.;
                float c2 =  max(0.09/pow(length(p-mouse*dist/.5)*1., .95), 0.0)/20.;
                float s = max(0.02-pow(regShape(p*5. + mouse*dist*5. + decay, 6) , 1.), 0.0)*1.5;
                
                color = (vec3(flare.colorGain));
                vec3 f = c*color;
                f += c1*color;
                f += c2*color;  
                f +=  s*color;
                return f;
            }
        
            vec4 getLensColor(float x){
                return vec4(vec3(mix(mix(mix(mix(mix(mix(mix(mix(mix(mix(mix(mix(mix(mix(mix(vec3(0., 0., 0.),
                vec3(0., 0., 0.), smoothstep(0.0, 0.063, x)),
                vec3(0., 0., 0.), smoothstep(0.063, 0.125, x)),
                vec3(0.0, 0., 0.), smoothstep(0.125, 0.188, x)),
                vec3(0.188, 0.131, 0.116), smoothstep(0.188, 0.227, x)),
                vec3(0.31, 0.204, 0.537), smoothstep(0.227, 0.251, x)),
                vec3(0.192, 0.106, 0.286), smoothstep(0.251, 0.314, x)),
                vec3(0.102, 0.008, 0.341), smoothstep(0.314, 0.392, x)),
                vec3(0.086, 0.0, 0.141), smoothstep(0.392, 0.502, x)),
                vec3(1.0, 0.31, 0.0), smoothstep(0.502, 0.604, x)),
                vec3(.1, 0.1, 0.1), smoothstep(0.604, 0.643, x)),
                vec3(1.0, 0.929, 0.0), smoothstep(0.643, 0.761, x)),
                vec3(1.0, 0.086, 0.424), smoothstep(0.761, 0.847, x)),
                vec3(1.0, 0.49, 0.0), smoothstep(0.847, 0.89, x)),
                vec3(0.945, 0.275, 0.475), smoothstep(0.89, 0.941, x)),
                vec3(0.251, 0.275, 0.796), smoothstep(0.941, 1.0, x))),
                1.0);
            }
        
            float dirtNoise(vec2 p){
                vec2 f = fract(p);
                f = (f * f) * (3.0 - (2.0 * f));    
                float n = dot(floor(p), vec2(1.0, 157.0));
                vec4 a = fract(sin(vec4(n + 0.0, n + 1.0, n + 157.0, n + 158.0)) * 43758.5453123);
                return mix(mix(a.x, a.y, f.x), mix(a.z, a.w, f.x), f.y);
            } 
        
            vec4 getLensStar(vec2 p){
                vec2 pp = (p - vec2(0.5)) * 2.0;
                float a = atan(pp.y, pp.x);
                vec4 cp = vec4(sin(a * 1.0), length(pp), sin(a * 13.0), sin(a * 53.0));
                float d = sin(clamp(pow(length(vec2(0.5) - p) * 0.5 + flare.haloScale /2., 5.0), 0.0, 1.0) * 3.14159);
                vec3 c = vec3(d) * vec3(max(max(max(max(0.5, sin(a * 1.0)), sin(a * 3.0) * 0.8), sin(a * 7.0) * 0.8), sin(a * 9.0) * 10.6));
                c *= vec3(mix(2.0, (sin(length(pp.xy) * 256.0) * 0.5) + 0.5, sin((clamp((length(pp.xy) - 0.875) / 0.1, 0.0, 1.0) + 0.0) * 2.0 * 3.14159) * 1.5) + 0.5) * 0.3275;
                return vec4(vec3(c * 1.0), d);	
            }
        
            vec4 textureLimited(sampler2D tex, vec2 texCoord){
                if(((texCoord.x < 0.) || (texCoord.y < 0.)) || ((texCoord.x > 1.) || (texCoord.y > 1.))){
                return vec4(0.0);
                }else{
                return texture(tex, texCoord); 
                }
            }
        
            vec4 textureDistorted(sampler2D tex, vec2 texCoord, vec2 direction, vec3 distortion) {
                return vec4(textureLimited(tex, (texCoord + (direction * distortion.r))).r,
                            textureLimited(tex, (texCoord + (direction * distortion.g))).g,
                            textureLimited(tex, (texCoord + (direction * distortion.b))).b,
                            1.0);
            }
        
           /* vec4 getStartBurst(){
                vec2 aspectTexCoord = vec2(1.0) - (((vTexCoord - vec2(0.5)) * vec2(1.0)) + vec2(0.5)); 
                vec2 texCoord = vec2(1.0) - vTexCoord; 
                vec2 ghostVec = (vec2(0.5) - texCoord) * uDispersal - lensPosition.xy;
                vec2 ghostVecAspectNormalized = normalize(ghostVec * vec2(1.0)) * vec2(1.0);
                vec2 haloVec = normalize(ghostVec) * uHaloWidth;
                vec2 haloVecAspectNormalized = ghostVecAspectNormalized * uHaloWidth;
                vec2 texelSize = vec2(1.0) / vec2(iResolution.xy);
                vec3 distortion = vec3(-(texelSize.x * uDistortion), 0.2, texelSize.x * uDistortion);
                vec4 c = vec4(0.0);
                for (int i = 0; i < 4; i++) {
                vec2 offset = texCoord + (ghostVec * float(i));
                c += textureDistorted(lensDirtTexture, offset, ghostVecAspectNormalized, distortion) * pow(max(0.0, 1.0 - (length(vec2(0.5) - offset) / length(vec2(0.5)))), 10.0);
                }                       
                vec2 haloOffset = texCoord + haloVecAspectNormalized; 
                return (c * getLensColor((length(vec2(0.5) - aspectTexCoord) / length(vec2(haloScale))))) + 
                    (textureDistorted(lensDirtTexture, haloOffset, ghostVecAspectNormalized, distortion) * pow(max(0.0, 1.0 - (length(vec2(0.5) - haloOffset) / length(vec2(0.5)))), 10.0));
            } */
            float sdCircle(vec2 p, float r){
                return length(p) - r;
            }

            void main() {
                vec2 uv = vUv;
                vec2 myUV = uv -0.5;
                myUV.y *= resolution.y/resolution.x;
                vec2 mouse = (lensPosition.xy * 2.0 - 1.0) * 0.5;
                mouse.y *= resolution.y/resolution.x;
                vec3 finalColor = LensFlare(flare, myUV, mouse) * 5.0 * flare.colorGain;
                vec3 lensPositionNDC = lensPosition * 2.0 - 1.0;
                if(flare.additionalStreaks){
                    vec3 circColor = mix(flare.colorGain, vec3(1.0), 0.3);
                    vec3 circColor2 =mix(flare.colorGain, vec3(1.0), 0.8);
        
                    for(float i=0.;i<10.;i++){
                    //finalColor += 0.1 * sdCircle
                        vec2 circleUv = (mouse.xy) * 2.0 * (i - 5.0 + rand(i + 10.0));
                        float sd = sdCircle(myUV - circleUv, 0.01 * rand(i));
                        if (sd < 0.0) {
                            finalColor += (1.0 - exp(sd)) * circColor * 100.0;
                        }
                    }
                }
                if(flare.secondaryGhosts){
                    vec3 altGhosts = vec3(0.1);
                    altGhosts += renderhex(flare, myUV, -lensPositionNDC.xy*0.25, flare.ghostScale * 1.4, flare.colorGain);
                    altGhosts += renderhex(flare, myUV, lensPositionNDC.xy*0.25, flare.ghostScale * 0.5, flare.colorGain);
                    altGhosts += renderhex(flare, myUV, lensPositionNDC.xy*0.1, flare.ghostScale * 1.6,flare.colorGain);
                    altGhosts += renderhex(flare, myUV, lensPositionNDC.xy*1.8, flare.ghostScale * 2.0, flare.colorGain);
                    altGhosts += renderhex(flare, myUV, lensPositionNDC.xy*1.25, flare.ghostScale * 0.8, flare.colorGain);
                    altGhosts += renderhex(flare, myUV, -lensPositionNDC.xy*1.25, flare.ghostScale * 5.0, flare.colorGain);
                    
                    //Circular ghost
                    altGhosts += fpow(1.0 - abs(distance(lensPositionNDC.xy*0.8,myUV) - 0.5),0.985)*vec3(.1);
                    altGhosts += fpow(1.0 - abs(distance(lensPositionNDC.xy*0.4,myUV) - 0.2),0.994)*vec3(.05);
                    finalColor += altGhosts;
                }
                if (lensPositionNDC.z > 1. || lensPositionNDC.z < -1. || dot(
                    cameraDirection, normalize(lensPosition - cameraPos)) < 0.0){
                    finalColor = vec3(0.0);
                }
                float occluded = textureLod(coverageTexture, vec2(0.5), 10000.0).r;//lensPosition.z > texture2D(depthTexture, lensPosition.xy).r ? 1.0 : 0.0;
                gl_FragColor = vec4((finalColor) * (1.0 - occluded), mix(finalColor, -vec3(.15), 0.5));
            }
            `,
            blending: THREE.AdditiveBlending,
            transparent: true
        }));

    }
    setDepthTexture(depthTexture) {
        this.depthTexture = depthTexture;
    }
    setSize(width, height) {
        this.width = width;
        this.height = height;
        this.flareRenderTarget.setSize(width / 2, height / 2);
    }

    render(renderer, inputBuffer, outputBuffer) {
        const xrEnabled = renderer.xr.enabled;
        renderer.xr.enabled = false;
        this.camera.updateMatrixWorld();
        renderer.setRenderTarget(this.flareRenderTarget);
        renderer.clear();
        for (const flare of this.flares) {
            flare.project(this.camera);
            renderer.setRenderTarget(this.coverageTarget);
            renderer.clear();
            this.coverageQuad.material.uniforms.depthTexture.value = this.depthTexture;
            this.coverageQuad.material.uniforms.lensPosition.value.copy(flare.lensPosition);
            this.coverageQuad.render(renderer);
            renderer.setRenderTarget(this.flareRenderTarget);
            const oldAutoClear = renderer.autoClear;
            renderer.autoClear = false;
            this.flareQuad.material.uniforms.depthTexture.value = this.depthTexture;
            this.flareQuad.material.uniforms.coverageTexture.value = this.coverageTarget.texture;
            this.flareQuad.material.uniforms.flare.value = flare;
            this.flareQuad.material.uniforms.lensPosition.value.copy(flare.lensPosition);
            this.flareQuad.material.uniforms.resolution.value.set(this.flareRenderTarget.width, this.flareRenderTarget.height);
            this.flareQuad.material.uniforms.cameraPos.value.copy(this.camera.getWorldPosition(new THREE.Vector3()));
            this.flareQuad.material.uniforms.cameraDirection.value.copy(this.camera.getWorldDirection(new THREE.Vector3()));
            this.flareQuad.render(renderer);
            renderer.autoClear = oldAutoClear;
        }

        renderer.setRenderTarget(
            this.renderToScreen ? null :
            outputBuffer
        );
        this.outputQuad.material.uniforms.tDiffuse.value = inputBuffer.texture;
        this.outputQuad.material.uniforms.texelSize.value.set(1 / this.flareRenderTarget.width, 1 / this.flareRenderTarget.height, this.flareRenderTarget.width, this.flareRenderTarget.height);
        this.outputQuad.render(renderer);
        renderer.xr.enabled = xrEnabled;
    }

}
export { LensFlarePass };