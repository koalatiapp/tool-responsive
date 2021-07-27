'use strict';

class Tool {
    constructor({ page, devices }) {
        this.page = page;
        this.devices = devices;
    }

    async run() {
        await this._analyze();
        this._formatResults();
    }

    get results() {
        return this._results;
    }

    async cleanup() {
        // Reset to default UA & standard computer resolution
        const originalUserAgent = await this.page.browser().userAgent();
        await this.page.emulate({
            userAgent: originalUserAgent,
            viewport: {
              width: 1920,
              height: 1080,
              deviceScaleFactor: 1,
              isMobile: false,
              hasTouch: false,
              isLandscape: true
            }
        });
    }

    _formatResults() {
        const weight = 1 / Object.keys(this._resultsByTest);
        this._results = [
            {
                'uniqueName': 'overflow',
                'title': 'Horizontal overflow',
                'description': 'Checks to make sure that your website\'s content fits in the screen\'s width on mobiles and tablets.',
                'weight': .25,
                'score': 1,
                'snippets': [],
            },
            {
                'uniqueName': 'viewport',
                'title': 'Viewport meta tag',
                'description': 'Checks that your page has a `viewport` meta tag, which is required in order to adjust correctly on mobiles and tablets.',
                'weight': .25,
                'score': 1,
                'snippets': [],
            },
            {
                'uniqueName': 'fontSize',
                'title': 'Font size readability',
                'description': 'Checks the font size for the text on your page to make sure it is not too small on mobiles and tablets. A font size of at least 12px is recommended for good reability and accessibility.',
                'weight': .25,
                'score': 1,
                'snippets': [],
            },
            {
                'uniqueName': 'aspectRatios',
                'title': 'Images aspect ratio',
                'description': 'Checks the images on your page to make sure that they do not appear stretched or distorted on mobiles and tablets.',
                'weight': .25,
                'score': 1,
                'snippets': [],
            },
        ];

        for (const result of this._results) {
            const faultyDevices = Object.keys(this._resultsByTest[result.uniqueName]);

            for (const deviceName of faultyDevices) {
                const deviceResult = this._resultsByTest[result.uniqueName][deviceName];

                if (!deviceResult.success) {
                    result.score -= .5;
                    result.snippets = result.snippets.concat(deviceResult.snippets || []);
                }
            }

            if (result.score < 1) {
                switch (result.uniqueName) {
                    case 'overflow':
                        result.recommendations = 'Fix content causing horizontal overflow on your page.';
                        break;

                    case 'viewport':
                        result.recommendations = 'Add a `viewport` meta tag to your page. The following should work for most projects: `<meta name="viewport" content="width=device-width, initial-scale=1">`.';
                        break;

                    case 'fontSize':
                        result.recommendations = 'Update your CSS to make sure the text on your page always has a font size of 12px or more.';
                        break;

                    case 'aspectRatios':
                        result.recommendations = 'Update your CSS to fix distorted images on your page. The `object-fit` CSS property might be a good place to look.';
                        break;
                }

                result.recommendations = [[result.recommendations + " The issue was detected on the following devices: %devices%.", { "%devices%": faultyDevices.join(', ') }]];
            }
        }
    }

    async _analyze() {
        const testDeviceNames = ['iPhone 7', 'iPhone XR', 'iPad', 'iPad Pro'];
        this._resultsByTest = {
            'overflow': {},
            'viewport': {},
            'fontSize': {},
            'aspectRatios': {}
        };

        for (const deviceName of testDeviceNames) {
            await this.page.emulate(this.devices[deviceName]);

            for (const test in this._resultsByTest) {
                const result = await this['_' + test]();

                if (!result.success) {
                    this._resultsByTest[test][deviceName] = result;
                }
            }
        }
    }

    async _overflow(page) {
        return await this.page.evaluate(function() {
            const body = document.querySelector('body');
            const bodyOverflows = function() { return body.scrollWidth > body.clientWidth; };
            const detectHorizontalOverflow = function(element) {
                if (bodyOverflows()) {
                    const originalDisplay = element.style.display;
                    element.style.display = 'none';

                    if (!bodyOverflows()) {
                        // This element or one of its children is the cause of the overflow
                        const originalMinHeight = element.style.minHeight;
                        element.style.display = originalDisplay;
                        element.style.minHeight = '1px';

                        const problematicChild = element.children.length > 0 ? detectHorizontalOverflow(element.children[0]) : false;

                        element.style.minHeight = originalMinHeight;

                        return problematicChild ? problematicChild : element;
                    } else {
                        // Check the next element
                        element.style.display = originalDisplay;
                        if (element.nextElementSibling) {
                            return detectHorizontalOverflow(element.nextElementSibling);
                        }
                    }
                }

                return false;
            };

            const overflowSource = detectHorizontalOverflow(body);
            if (overflowSource) {
                overflowSource.innerHTML = '';
                overflowSource.style.minHeight = '';
                overflowSource.style.display = '';

                if (!overflowSource.getAttribute('style')) {
                    overflowSource.removeAttribute('style');
                }

                let tagHtml = overflowSource.outerHTML;
                tagHtml = tagHtml.substr(0, tagHtml.lastIndexOf("</")); // Only keep the opening tag

                return { success: false, snippets: [tagHtml] };
            }

            return { success: true };
        });
    }

    async _viewport(page) {
        return await this.page.evaluate(function() {
            const viewportMeta = document.querySelector('meta[name="viewport"]');
            const viewportIsInvalid = !viewportMeta || viewportMeta.getAttribute('content').trim().toLowerCase().indexOf('width=') == -1;
            return { success: !viewportIsInvalid };
        });
    }

    async _fontSize(page) {
        return await this.page.evaluate(function() {
            let elements = [];
            let nodes = document.querySelectorAll('*');

            for (let elementIndex in nodes) {
                let element = nodes[elementIndex];

                if (typeof element != 'object') {
                    continue;
                }

                let styles = window.getComputedStyle(element);
                if (typeof styles.fontSize != 'undefined' && styles.fontSize && parseFloat(styles.fontSize) < 12) {
                    if (['cufon', 'sup', 'sub'].indexOf(element.tagName.toLowerCase()) != -1 || (styles.textIndent && Math.abs(parseInt(styles.textIndent)) > element.offsetWidth) || element.offsetWidth == 0 || element.offsetHeight == 0 || (['body', 'html'].indexOf(element.tagName.toLowerCase()) == -1 && element.offsetParent === null) || styles.display == 'none' || styles.opacity == 0) {
                        continue;
                    }

                    if (element.textContent.trim().length == 0 && ['input', 'select', 'textarea'].indexOf(element.tagName.toLowerCase()) == -1) {
                        continue;
                    }

                    let excludedTerms = ['©', 'copyright', 'terms', 'policy'];
                    let containsExcludedTerms = false;
                    let lowercaseContent = element.textContent.trim().toLowerCase();
                    for (let termsIndex = 0; termsIndex < excludedTerms.length; termsIndex++) {
                        if (lowercaseContent.indexOf(excludedTerms[termsIndex]) != -1) {
                            containsExcludedTerms = true;
                            break;
                        }
                    }

                    if (containsExcludedTerms) {
                        continue;
                    }

                    let hiddenParent = false;
                    let isInsideSubSup = false;
                    let parent = element.parentElement;
                    while (parent) {
                        let parentStyles = window.getComputedStyle(parent);

                        if ((['body', 'html'].indexOf(parent.tagName.toLowerCase()) == -1 && parent.offsetParent === null) || parentStyles.display == 'none' || parentStyles.opacity == 0 || parentStyles.visibility == 'hidden' || ((parent.offsetWidth == 0 || parent.offsetHeight == 0) && parentStyles.overflow == 'hidden')) {
                            hiddenParent = true;
                            break;
                        } else if (['sup', 'sub'].indexOf(parent.tagName.toLowerCase()) != -1) {
                            isInsideSubSup = true;
                            break;
                        }

                        parent = parent.parentElement;
                    }

                    if (hiddenParent || isInsideSubSup) {
                        continue;
                    }

                    let alreadyHaveParent = false;
                    for (foundElementIndex in elements) {
                        let foundElement = elements[foundElementIndex];
                        if (foundElement.contains(element)) {
                            alreadyHaveParent = true;
                            break;
                        }
                    }

                    if (alreadyHaveParent) {
                        continue;
                    }

                    elements.push(element);
                }
            }

            let elementPreviews = [];
            for (let elementIndex in elements) {
                let element = elements[elementIndex];
                elementPreviews.push(element.outerHTML);
            }

            return { success: elementPreviews.length == 0, elements: elementPreviews };
        });
    }

    async _aspectRatios(page) {
        return await this.page.evaluate(function() {
            function checkAspectRatio(element) {
                if (!element.width || !element.height || !element.naturalHeight) {
                    return null;
                }
                const ratios = [(element.width / element.height), (element.naturalWidth / element.naturalHeight)];
                const percentage = Math.min.apply(null, ratios) / Math.max.apply(null, ratios);
                return percentage <= .99 ? percentage.toFixed(2) : null;
            }

            const snippets = [];
            for (const element of document.querySelectorAll('img[src]')) {
                if (!(element.src || element.currentSrc)) {
                    continue;
                }

                let hiddenParent = false;
                let parent = element.parentElement;
                while (!hiddenParent && parent) {
                    const parentStyles = window.getComputedStyle(parent);

                    if ((['body', 'html'].indexOf(parent.tagName.toLowerCase()) == -1 && parent.offsetParent === null && parentStyles.position != 'fixed') ||
                        parentStyles.display == 'none' ||
                        parentStyles.opacity == 0 ||
                        ((parent.offsetWidth == 0 || parent.offsetHeight == 0) && parentStyles.overflow == 'hidden')) {
                        hiddenParent = true;
                    }

                    parent = parent.parentElement;
                }

                if (hiddenParent) {
                    continue;
                }

                const percentage = checkAspectRatio(element);
                if (percentage !== null) {
                    const imageUrl = element.currentSrc ? element.currentSrc : element.src;
                    if (imageUrl.split('#')[0].split('?')[0].substr(-4).toLowerCase() != '.svg') {
                        const elementStyles = window.getComputedStyle(element);

                        if (['contain', 'cover', 'none', 'scale-down'].indexOf(elementStyles.objectFit) == -1) {
                            snippets.push(element.outerHTML);
                        }
                    }
                }
            }
            return { success: snippets.length == 0, snippets: snippets };
        });
    }
}

module.exports = Tool;
