'use strict';

class Tool {
    constructor({ page, devices }) {
        this.page = page;
        this.devices = devices;
    }

    async run() {
        console.log(this.devices);
    }

    get results() {
        return [
            {
                'uniqueName': 'your_test_unique_name', // a test name that is unique within your tool. this will be prefixed with your tool's name to generate a Koalati-wide unique name for this test.
                'title': 'Your test\'s user-friendly title',
                'description': 'Your test\'s user-friendly description.', // This can be a static description of what your test looks for, or a dynamic one that describes the results.
                'weight': 1, // the weight of this test's score as a float. the sum of the weights of all your results should be 1.0
                'score': 1, // the score obtained as a float: 0.5 is 50%, 1.0 is 100%, etc.
                // 'snippets': [], // a one-dimensional array of strings and/or ElementHandle that can be represented as code snippets in Koalati's results
                // 'table': [], // a two-dimensional array of data that will be represented as a table in Koalati's results. The first row should contain the column's headings.
                // 'recommendations': '', // a string or an array of string that gives recommendations, telling the user what can be done to improve the page
            },
            // ...
        ];
    }

    async cleanup() {

    }

    async _overflow(page) {
        try {
            let result = await page.evaluate(function(){
                let body = document.querySelector('body');
                let bodyOverflows = function(){ return body.scrollWidth > body.clientWidth; };
                let detectHorizontalOverflow = function(element){
                    if (bodyOverflows()) {
                        let originalDisplay = element.style.display;
                        element.style.display = 'none';

                        if (!bodyOverflows()) {
                            // This element or one of its children is the cause of the overflow
                            let originalMinHeight = element.style.minHeight;
                            element.style.display = originalDisplay;
                            element.style.minHeight = '1px';

                            let problematicChild = element.children.length > 0 ? detectHorizontalOverflow(element.children[0]) : false;

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

                let overflowSource = detectHorizontalOverflow(body);
                if (overflowSource) {
                    overflowSource.innerHTML = '';
                    overflowSource.style.minHeight = '';
                    overflowSource.style.display = '';

                    if (!overflowSource.getAttribute('style')) {
                        overflowSource.removeAttribute('style');
                    }

                    let tagHtml = overflowSource.outerHTML;
                    tagHtml = tagHtml.substr(0, tagHtml.lastIndexOf("</")); // Only keep the opening tag

                    return { success: false, element: tagHtml };
                } else {
                    return { success: true };
                }
            });
            return result;
        } catch (e) {
            return null;
        }
    },

    async _viewport(page) {
        try {
            let result = await page.evaluate(function(){
                let viewportMeta = document.querySelector('meta[name="viewport"]');
                let viewportIsInvalid = !viewportMeta || viewportMeta.getAttribute('content').trim().toLowerCase().indexOf('width=') == -1;

                return { success: !viewportIsInvalid };
            });
            return result;
        } catch (e) {
            return null;
        }
    },

    async _content_width(page) {
        try {
            let result = await page.evaluate(function(){
                return { success: window.outerWidth == 0 || window.innerWidth === window.outerWidth };
            });
            return result;
        } catch (e) {
            return null;
        }
    },

    async _font_size(page) {
        try {
            let result = await page.evaluate(function(){
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

            return result;
        } catch (e) {
            return null;
        }
    },

    async _aspect_ratios(page) {
        try {
            let result = await page.evaluate(function(){
                function checkAspectRatio(element) {
                    if (!element.width || !element.height || !element.naturalHeight) {
                        return null;
                    }
                    let ratios = [(element.width / element.height), (element.naturalWidth / element.naturalHeight)];
                    let percentage = Math.min.apply(null, ratios) / Math.max.apply(null, ratios);
                    return percentage <= .95 ? percentage.toFixed(2) : null;
                }

                let images = [];
                let nodes = document.querySelectorAll('img[src]');
                for (let elementIndex in nodes) {
                    let element = nodes[elementIndex];

                    if (typeof element != 'object' || !(element.src || element.currentSrc)) {
                        continue;
                    }

                    let hiddenParent = false;
                    let parent = element.parentElement;
                    while (!hiddenParent && parent) {
                        let parentStyles = window.getComputedStyle(parent);

                        if ((['body', 'html'].indexOf(parent.tagName.toLowerCase()) == -1 && parent.offsetParent === null) || parentStyles.display == 'none' || parentStyles.opacity == 0 || ((parent.offsetWidth == 0 || parent.offsetHeight == 0) && parentStyles.overflow == 'hidden')) {
                            hiddenParent = true;
                        }

                        parent = parent.parentElement;
                    }

                    if (hiddenParent) {
                        continue;
                    }

                    let percentage = checkAspectRatio(element);
                    if (percentage !== null) {
                        let imageUrl = element.currentSrc ? element.currentSrc : element.src;
                        if (imageUrl.split('#')[0].split('?')[0].substr(-4).toLowerCase() != '.svg') {
                            images.push({ tag: element.outerHTML, percentage: percentage });
                        }
                    }
                }
                return { success: images.length == 0, images: images };
            });
            return result;
        } catch (e) {
            return null;
        }
    }
}

module.exports = Tool;
