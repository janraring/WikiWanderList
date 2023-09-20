var lang = "";
var href = "";
var title = "";
var html = "";

function init() {
    if (!localStorage.getItem("pageLang")) {
        firstTimeInit();
    } else {
        startUpInit();
    }
}

function firstTimeInit() {
    localStorage.setItem("dereadArticles", JSON.stringify([]));
    localStorage.setItem("dewikiLinkChart", '{ "entries" : []}');
    localStorage.setItem("enreadArticles", JSON.stringify([]));
    localStorage.setItem("enwikiLinkChart", '{ "entries" : []}');
    lang = "de";
    startUpInit();
}

function startUpInit() {
    const form = document.querySelector('.js-search-form');
    form.addEventListener('submit', handleSubmit);

    const engButton = document.getElementById('en');
    engButton.addEventListener('click', toEnglish);

    const gerButton = document.getElementById('de');
    gerButton.addEventListener('click', zuDeutsch);

    const checkbox = document.getElementById('checkbox-read');
    checkbox.addEventListener('change', boxChanged);

    if (localStorage.getItem("pageLang")) {
        lang = localStorage.getItem("pageLang");
        title = localStorage.getItem("pageTitle");
        href = localStorage.getItem("pageHref");

        document.querySelector('.js-search-input').value = title;
        document.querySelector('.js-search-form').dispatchEvent(new Event("submit"));
    }

    document.getElementById(lang).dispatchEvent(new Event("click"));
}

async function handleSubmit(event) {
    event.preventDefault();
    clearSearchResult();
    spinnerOn();
    searchQuery = getQuery();
    html = await getArticleHTML(searchQuery);
    displayArticle();
    offerCheckbox();
    replaceLinks();
}

function clearSearchResult() {
    const searchResults = document.querySelector('.js-search-result');
    searchResults.innerHTML = '';
}

function spinnerOn() {
    const spinner = document.querySelector('.js-spinner');
    spinner.classList.remove('hidden');
}

function spinnerOff() {
    const spinner = document.querySelector('.js-spinner');
    spinner.classList.add('hidden');
}

function getQuery() {
    return document.querySelector('.js-search-input').value.trim();
}

function logError(err) {
    console.log(err);
    alert("Oopsi, that didn't work :(");
}

async function getArticleHTML(searchQuery) {
    try {
        let results = await fetchResults(searchQuery);
        let toptitle = fetchTopResult(results);
        return await fetchHTML(toptitle);
    } catch (err) {
        logError(err);
    } finally {
        spinnerOff();
    }
}

async function fetchResults(searchQuery) {
    const endpoint = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&prop=info&inprop=url&utf8=&format=json&origin=*&srlimit=1&srsearch=${searchQuery}`;
    const response = await fetch(endpoint);
    const data = await response.json();
    return articles = data.query.search;
}

function fetchTopResult(results) {
    const result = results[0];
    const title = result.title;


    localStorage.setItem("pageLang", lang);
    //localStorage.setItem("pageHref", result.href);
    localStorage.setItem("pageTitle", title);
    //localStorage.setItem("pageId", lang+title);

    document.getElementById("pagetitle").innerHTML = `${title} &mdash; WikiWanderList`;
    return title;
}

async function fetchHTML(title) {
    let url = `https://api.wikimedia.org/core/v1/wikipedia/${lang}/page/${title}/html`;
    let response = await fetch(url);
    return await response.text();
}

function displayArticle() {
    var bodyStart = html.indexOf('<section');
    var bodyEnd = html.indexOf('</body>');

    var body = html.slice(bodyStart, bodyEnd);
    document.querySelector('.js-search-result').insertAdjacentHTML('beforeend', body);
    localStorage.setItem("pageLang", lang);
}

function offerCheckbox() {
    const pageTitle = localStorage.getItem("pageTitle");
    const pageLang = localStorage.getItem("pageLang");

    const readArticles = JSON.parse(localStorage.getItem(lang + "readArticles"));

    const cb_wrapper = document.getElementById('cb-wrapper');
    const checkbox = document.getElementById('checkbox-read');

    if (pageLang == lang) {
        cb_wrapper.style.visibility = 'visible';
    } else {
        cb_wrapper.style.visibility = 'hidden';
    }

    if (readArticles.indexOf(pageTitle) > -1) {
        checkbox.checked = true;
    } else {
        checkbox.checked = false;
    }
}

async function boxChanged(event) {
    const jsonLinks = await getLinkedPages();
    if (event.currentTarget.checked) {
        addCurrentArticle();
        incrementPageCounts(jsonLinks);
    } else {
        removeCurrentArticle();
        decrementPageCounts(jsonLinks);
    }
    refreshChart();
}

async function getLinkedPages() {
    let paragraphs = await getParagraphs();

    const jsonLinks = JSON.parse('{ "links" : []}');
    for (let i = 0, len = paragraphs.length; i < len; i++) {
        let links = await paragraphs[i].getElementsByTagName("a");

        for (let j = 0; j < links.length; j++) {
            if (isGoodLink(links[j].outerHTML)) {
                let href = links[j].attributes.href.nodeValue.trim();
                let title = links[j].attributes.title.nodeValue.trim();

                if (!isDuplicate(jsonLinks, href)) {
                    jsonLinks.links.push({
                        "href": href,
                        "title": title
                    });
                }
            }
        }
    }
    return jsonLinks;
}

async function getParagraphs() {
    parser = new DOMParser();
    xmlDoc = parser.parseFromString(html, "text/xml");
    return await xmlDoc.getElementsByTagName("p");
}

function isGoodLink(link) {
    if (link.indexOf("mw:WikiLink") == -1) {
        return false;
    } else if (link.indexOf("#") != -1) {
        return false;
    } else if (link.indexOf("Table_of") != -1) {
        return false;
    } else if (link.indexOf("List_of") != -1) {
        return false;
    } else if (link.indexOf("Datei:") != -1) {
        return false;
    } else if (link.indexOf("Help:") != -1) {
        return false;
    } else if (link.indexOf("Hilfe:") != -1) {
        return false;
    } else if (link.indexOf("Wikipedia:") != -1) {
        return false;
    } else {
        return true;
    }
}

function isDuplicate(jsonLinks, href) {
    if (JSON.stringify(jsonLinks).indexOf(href) == -1) {
        return false;
    } else {
        return true;
    }
}

function addCurrentArticle() {
    const pageTitle = localStorage.getItem("pageTitle");
    let readArticles = JSON.parse(localStorage.getItem(lang + "readArticles"));
    readArticles.push(pageTitle);
    localStorage.setItem(lang + "readArticles", JSON.stringify(readArticles));

    let raw = localStorage.getItem(lang + "wikiLinkChart");
    let jsonChart = JSON.parse(raw);

    if (raw.indexOf(pageTitle) != -1) {
        for (var i = 0; i < jsonChart.entries.length; i++) {
            if (jsonChart.entries[i].title == pageTitle) {
                jsonChart.entries.splice(i, 1);
            }
        }
    }

    localStorage.setItem(lang + "wikiLinkChart", JSON.stringify(jsonChart));
}

function removeCurrentArticle() {
    const pageTitle = localStorage.getItem("pageTitle");
    let readArticles = JSON.parse(localStorage.getItem(lang + "readArticles"));
    readArticles = readArticles.filter(value => { return value != pageTitle });
    localStorage.setItem(lang + "readArticles", JSON.stringify(readArticles));
}

function incrementPageCounts(jsonLinks) {
    let rawRead = localStorage.getItem(lang + "readArticles");
    let rawChart = localStorage.getItem(lang + "wikiLinkChart")
    let jsonChart = JSON.parse(rawChart);

    for (link of jsonLinks.links) {
        if (rawRead.indexOf(link.title) == -1) {
            if (rawChart.indexOf(link.title) == -1) {
                jsonChart.entries.push({
                    "title": link.title,
                    "href": link.href,
                    "count": 1
                });
            } else {
                for (entry of jsonChart.entries) {
                    if (entry.href == link.href) {
                        entry.count = Number(entry.count) + 1;
                    }
                }
            }
        }
    }

    localStorage.setItem(lang + "wikiLinkChart", JSON.stringify(jsonChart));
}

function decrementPageCounts(jsonLinks) {
    let raw = localStorage.getItem(lang + "wikiLinkChart");
    let jsonChart = JSON.parse(raw);

    linkLen = jsonLinks.links.length;
    entryLen = jsonChart.entries.length;

    for (j = entryLen - 1; j >= 0; j--) {
        entry = jsonChart.entries[j];
        for (i = 0; i < linkLen; i++) {
            link = jsonLinks.links[i];
            if (entry.href == link.href) {
                if (entry.count == 1) {
                    jsonChart.entries.splice(j, 1);
                } else {
                    entry.count = Number(entry.count) - 1;
                }
                break;
            }
        }
    }

    localStorage.setItem(lang + "wikiLinkChart", JSON.stringify(jsonChart));
}

async function replaceLinks() {
    links = await document.getElementsByTagName("a");
    for (var i = links.length - 1; i >= 0; i--) {
        plainLink = links[i].outerHTML;
        if (isWikiLink(plainLink)) {
            let btn = document.createElement('button');

            btn.textContent = links[i].textContent;
            btn.value = links[i].title;
            btn.className = "wikiButton";
            btn.addEventListener("click", linkClicked);

            links[i].replaceWith(btn);
        }
    }
}

function isWikiLink(link) {
    if (link.indexOf("mw:WikiLink") == -1) {
        return false;
    } else if (link.indexOf("Help:") != -1) {
        return false;
    } else if (link.indexOf("Wikipedia:") != -1) {
        return false;
    } else {
        return true;
    }
}

function linkClicked(event) {
    document.querySelector('.js-search-input').value = event.target.value;
    submit = new Event("submit");
    document.querySelector('.js-search-form').dispatchEvent(submit);
}

function refreshChart() {
    chartButtons = document.getElementsByClassName("chart-button");
    for (i = chartButtons.length - 1; i >= 0; i--) {
        chartButtons[i].remove();
    }
    displayChart();
}

async function displayChart() {
    let raw = localStorage.getItem(lang + "wikiLinkChart")
    let jsonChart = JSON.parse(raw);
    await jsonChart.entries.sort(compareByCount);
    console.log(jsonChart.entries);

    var numberArticles = jsonChart.entries.length;

    if (numberArticles == 0) {
        console.log("No suggestions")
    } else {
        for (i = 0; i < 50 && i < numberArticles; i++) {
            entry = jsonChart.entries[i];

            var chartButton = document.createElement("button");
            chartButton.textContent = entry.title;
            chartButton.value = entry.title;
            chartButton.style.order = entry.count;
            chartButton.style.backgroundColor = getColor(entry.count);
            chartButton.className = "chart-button";
            chartButton.addEventListener("click", linkClicked);

            document.getElementById("js-chart").insertAdjacentElement("beforeend", chartButton);
        }
    }
}

function getColor(c) {
    var gradient = 2 * Math.atan(c * 0.1) / Math.PI;
    var rs = 211;
    var gs = 224;
    var bs = 224;
    var rd = -208
    var gd = -16
    var bd = 0
    var rz = parseInt(rs + gradient * rd);
    var gz = parseInt(gs + gradient * gd);
    var bz = parseInt(bs + gradient * bd);
    return "rgb(" + rz + "," + gz + "," + bz + ")";
}

function compareByCount(a, b) {
    if (a.count < b.count) {
        return 1;
    } else if (a.count > b.count) {
        return -1;
    } else return 0;
}

function toEnglish(event) {
    lang = "en";
    document.getElementById("en").style.backgroundColor = "rgb(136, 242, 164)";
    document.getElementById("de").style.backgroundColor = "rgb(250, 251, 252)";
    offerCheckbox();
    refreshChart();
}

function zuDeutsch(event) {
    lang = "de";
    document.getElementById("de").style.backgroundColor = "rgb(136, 242, 164)";
    document.getElementById("en").style.backgroundColor = "rgb(250, 251, 252)";
    offerCheckbox();
    refreshChart();
}
