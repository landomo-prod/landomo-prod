import axios from 'axios';
import { getRandomUserAgent } from '../utils/userAgents';

const LISTINGS_QUERY = `query ListAdverts(
  $offerType: [OfferType],
  $estateType: [EstateType],
  $order: ResultOrder,
  $limit: Int,
  $offset: Int,
  $locale: Locale!
) {
  listAdverts(
    offerType: $offerType
    estateType: $estateType
    order: $order
    limit: $limit
    offset: $offset
    locale: $locale
  ) {
    totalCount
    list {
      id
      externalId
      hash
      uri
      code
      active
      isPausedBySystem
      isPausedByUser
      activationPending
      archived
      reserved
      highlighted
      isNew
      isEditable
      timeActivated
      timeDeactivated
      timeExpiration
      timeOrder
      daysActive
      title
      titleEnglish
      description
      descriptionEnglish
      descriptionSk
      imageAltText(locale: $locale)
      estateType
      offerType
      disposition
      landType
      houseType
      surface
      surfaceLand
      balconySurface
      loggiaSurface
      terraceSurface
      cellarSurface
      price
      priceFormatted(locale: $locale)
      deposit
      charges
      serviceCharges
      utilityCharges
      fee
      currency
      originalPrice
      isDiscounted
      serviceChargesNote
      utilityChargesNote
      gps {
        lat
        lng
      }
      address(locale: $locale)
      addressInput
      street
      houseNumber
      city(locale: $locale)
      cityDistrict(locale: $locale)
      zip
      region {
        id
        name
        uri
      }
      ruianId
      addressPointId
      isPrague
      isBrno
      isPragueWest
      isPragueEast
      isCityWithDistricts
      isTSRegion
      condition
      ownership
      equipped
      construction
      position
      situation
      floor
      totalFloors
      age
      execution
      reconstruction
      penb
      lowEnergy
      heating
      water
      sewage
      parking
      garage
      lift
      balcony
      terrace
      cellar
      loggia
      frontGarden
      newBuilding
      petFriendly
      barrierFree
      roommate
      shortTerm
      minRentDays
      maxRentDays
      availableFrom
      publicImages {
        id
        url(filter: RECORD_MAIN)
        order
        main
        filename
      }
      tour360
      visitCount
      conversationCount
      locale
      charity
      showOwnest
      showPriceSuggestionButton
      threesome
      fivesome
      brizCount
      realmanExportEnabled
      hasContractRent
      rentPlatformStatus
      rentPlatformOrder
      tags(locale: $locale)
    }
  }
}`;

async function main() {
  const { data } = await axios.post(
    'https://api.bezrealitky.cz/graphql/',
    {
      operationName: 'ListAdverts',
      variables: {
        offerType: ['PRODEJ'],
        estateType: ['BYT'],
        order: 'TIMEORDER_DESC',
        limit: 5,
        offset: 0,
        locale: 'CS',
      },
      query: LISTINGS_QUERY,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': getRandomUserAgent(),
        Accept: 'application/json',
      },
    }
  );
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
