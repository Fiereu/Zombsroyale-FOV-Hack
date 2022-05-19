console.log("Loading")

const injectScript = function(scriptUrl) {
    const newScript = document.createElement('script');

    newScript.src = chrome.runtime.getURL(scriptUrl);

    const injectElement = document.head || document.documentElement;
    injectElement.insertBefore(newScript, injectElement.firstChild);
    newScript.onload = function() {
        newScript.parentNode.removeChild(newScript);
    };
};

injectScript("/js/lib/stacktrace.js");
injectScript("/js/lib/jquery.js");
injectScript("/js/lib/wail.js");
injectScript("/js/Brecher.js");
injectScript("/js/payload.js");