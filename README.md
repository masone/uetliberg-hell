# Üetliberg Hell!

Digital-era "Üetliberg Hell" detection. When Zurich sinks into fog, Üetliberg breaks through the grey. This app is guiding you to clear skies, light, and warmth above the city.


> Was Fry jedoch vermisse, sei der Hinweis «Uetliberg hell» an den Trams in der Stadt. Die Tafel war früher an den Fahrzeugen der Linien 8, 13 und 14 angebracht, um die Stadtbevölkerung zu informieren, dass die Spitze des Stadtberges aus dem Nebel rage.<br/>
> [Uto-Kulm-Wirt wünscht sich dieses Schild auf den Trams zurück](https://www.20min.ch/story/uto-kulm-fabian-fry-fordert-rueckkehr-des-uetliberg-hell-schilds-103214839)


![Hell](./hell.jpg)

## Detection

Each webcam frame is judged by the [OpenAI Decisions API](https://developers.openai.com/api/docs/guides/decisions) (`gpt-6-luna`) with two yes/no questions: is the summit clear of fog, and is the sun out. It's hell when both clear their thresholds (`lib/weather-conditions.ts`). The raw probabilities are cached with every verdict.
